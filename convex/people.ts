import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { allocateUniqueCheckInToken } from "./lib/checkInToken";
import { buildStoredName, personDisplayName } from "./lib/personDisplay";
import { personGender, personRosterStatus } from "./lib/personModel";
import { requireAdminSession } from "./lib/adminSession";

function genderForApi(
  stored: "female" | "male" | undefined,
): "female" | "male" {
  return stored === "female" ? "female" : "male";
}

/** Normalise legacy "visitor"/"member" status values from pre-migration rows. */
function statusForApi(
  stored: string,
): "M" | "M_U18" | "NV" | "RV" | "VO" {
  if (stored === "member") return "M";
  if (stored === "visitor") return "NV";
  return stored as "M" | "M_U18" | "NV" | "RV" | "VO";
}

const personPublic = v.object({
  _id: v.id("people"),
  name: v.string(),
  status: personRosterStatus,
});

export const listPeoplePublic = query({
  args: {},
  returns: v.array(personPublic),
  handler: async (ctx) => {
    const people = await ctx.db.query("people").collect();
    return people
      .map((p) => ({
        _id: p._id,
        name: personDisplayName(p),
        status: statusForApi(p.status),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const listPeopleAdmin = query({
  args: { sessionToken: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("people"),
      name: v.string(),
      displayName: v.string(),
      givenName: v.string(),
      surname: v.string(),
      gender: personGender,
      teamId: v.optional(v.id("teams")),
      teamName: v.optional(v.string()),
      status: personRosterStatus,
      createdAt: v.number(),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      suburb: v.optional(v.string()),
      contactByEmail: v.boolean(),
      contactByPhone: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken);
    const people = await ctx.db.query("people").collect();
    const teams = await ctx.db.query("teams").collect();
    const teamById = new Map(teams.map((t) => [t._id, t.name]));
    const visitorRows = await ctx.db.query("visitors").collect();
    const contactByPerson = new Map(
      visitorRows.map((r) => [r.personId, r]),
    );
    return people
      .map((p) => {
        const vrow = contactByPerson.get(p._id);
        return {
          _id: p._id,
          name: p.name,
          displayName: personDisplayName(p),
          givenName: p.givenName ?? "",
          surname: p.surname ?? "",
          gender: genderForApi(p.gender),
          teamId: p.teamId,
          teamName: p.teamId ? teamById.get(p.teamId) : undefined,
          status: statusForApi(p.status),
          createdAt: p.createdAt,
          phone: vrow?.phone,
          email: vrow?.email,
          suburb: vrow?.suburb,
          contactByEmail: vrow?.contactByEmail ?? false,
          contactByPhone: vrow?.contactByPhone ?? false,
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  },
});

export const createPerson = mutation({
  args: {
    sessionToken: v.string(),
    givenName: v.string(),
    surname: v.string(),
    gender: personGender,
    teamId: v.optional(v.id("teams")),
    status: personRosterStatus,
  },
  returns: v.id("people"),
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken);
    const name = buildStoredName(args.givenName, args.surname);
    const givenName = args.givenName.trim();
    const surname = args.surname.trim();
    return await ctx.db.insert("people", {
      name,
      givenName,
      surname,
      gender: args.gender,
      teamId: args.teamId,
      status: args.status,
      createdAt: Date.now(),
    });
  },
});

const importMemberRow = v.object({
  line: v.number(),
  givenName: v.string(),
  surname: v.string(),
  gender: v.optional(v.string()),
  teamName: v.optional(v.string()),
  status: v.optional(v.string()),
});

function normalizeImportGender(raw: string | undefined): "female" | "male" {
  const s = (raw ?? "").trim().toLowerCase();
  if (
    s === "f" ||
    s === "female" ||
    s === "woman" ||
    s === "girl"
  ) {
    return "female";
  }
  return "male";
}

function normalizeImportStatus(
  raw: string | undefined,
): "M" | "M_U18" | "NV" | "RV" | "VO" {
  const s = (raw ?? "").trim().toUpperCase().replace(/-/g, "_").replace(/\s+/g, "_");
  if (!s || s === "MEMBER") return "M";
  if (s === "MU18" || s === "M_U18") return "M_U18";
  if (s === "M") return "M";
  if (s === "NV") return "NV";
  if (s === "RV") return "RV";
  if (s === "VO") return "VO";
  return "M";
}

/** Bulk-create people from CSV-parsed rows (max 200 per call). */
export const importMembers = mutation({
  args: {
    sessionToken: v.string(),
    members: v.array(importMemberRow),
  },
  returns: v.object({
    created: v.number(),
    failed: v.array(
      v.object({
        line: v.number(),
        message: v.string(),
      }),
    ),
    warnings: v.array(
      v.object({
        line: v.number(),
        message: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken);
    if (args.members.length > 200) {
      throw new Error("At most 200 rows per import batch");
    }
    const teams = await ctx.db.query("teams").collect();
    const teamByLower = new Map(
      teams.map((t) => [t.name.trim().toLowerCase(), t._id]),
    );

    const failed: { line: number; message: string }[] = [];
    const warnings: { line: number; message: string }[] = [];
    let created = 0;

    for (const m of args.members) {
      const givenName = m.givenName.trim();
      if (!givenName) {
        failed.push({ line: m.line, message: "Given name is required" });
        continue;
      }
      const surname = (m.surname ?? "").trim();
      try {
        const name = buildStoredName(givenName, surname);
        const gender = normalizeImportGender(m.gender);
        const status = normalizeImportStatus(m.status);
        let teamId: Id<"teams"> | undefined;
        const teamRaw = m.teamName?.trim();
        if (teamRaw) {
          const tid = teamByLower.get(teamRaw.toLowerCase());
          if (tid) {
            teamId = tid;
          } else {
            warnings.push({
              line: m.line,
              message: `Cell group "${teamRaw}" not found; person added without a cell group.`,
            });
          }
        }
        await ctx.db.insert("people", {
          name,
          givenName,
          surname,
          gender,
          teamId,
          status,
          createdAt: Date.now(),
        });
        created += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not create person";
        failed.push({ line: m.line, message: msg });
      }
    }

    return { created, failed, warnings };
  },
});

export const updatePerson = mutation({
  args: {
    sessionToken: v.string(),
    personId: v.id("people"),
    givenName: v.string(),
    surname: v.string(),
    gender: personGender,
    teamId: v.optional(v.id("teams")),
    status: personRosterStatus,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken);
    const existing = await ctx.db.get(args.personId);
    if (!existing) {
      throw new Error("Person not found");
    }
    const name = buildStoredName(args.givenName, args.surname);
    const givenName = args.givenName.trim();
    const surname = args.surname.trim();
    await ctx.db.patch(args.personId, {
      name,
      givenName,
      surname,
      gender: args.gender,
      teamId: args.teamId,
      status: args.status,
    });
    return null;
  },
});

export const removePerson = mutation({
  args: { sessionToken: v.string(), personId: v.id("people") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken);
    const records = await ctx.db
      .query("attendance")
      .withIndex("by_person", (q) => q.eq("personId", args.personId))
      .collect();
    for (const r of records) {
      await ctx.db.delete(r._id);
    }
    const visitor = await ctx.db
      .query("visitors")
      .withIndex("by_person", (q) => q.eq("personId", args.personId))
      .first();
    if (visitor) {
      await ctx.db.delete(visitor._id);
    }
    await ctx.db.delete(args.personId);
    return null;
  },
});

export const setPersonStatus = mutation({
  args: {
    sessionToken: v.string(),
    personId: v.id("people"),
    status: personRosterStatus,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken);
    await ctx.db.patch(args.personId, { status: args.status });
    return null;
  },
});

/** Create a personal check-in token if missing (admin). Use for QR / link. */
export const ensureCheckInToken = mutation({
  args: {
    sessionToken: v.string(),
    personId: v.id("people"),
  },
  returns: v.object({ token: v.string() }),
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken);
    const person = await ctx.db.get(args.personId);
    if (!person) {
      throw new Error("Person not found");
    }
    if (person.checkInToken) {
      return { token: person.checkInToken };
    }
    const token = await allocateUniqueCheckInToken(ctx);
    await ctx.db.patch(args.personId, { checkInToken: token });
    return { token };
  },
});

/** Invalidate the old link and assign a new token (admin). */
export const rotateCheckInToken = mutation({
  args: {
    sessionToken: v.string(),
    personId: v.id("people"),
  },
  returns: v.object({ token: v.string() }),
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken);
    const person = await ctx.db.get(args.personId);
    if (!person) {
      throw new Error("Person not found");
    }
    const token = await allocateUniqueCheckInToken(ctx);
    await ctx.db.patch(args.personId, { checkInToken: token });
    return { token };
  },
});
