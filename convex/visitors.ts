import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireAdminSession } from "./lib/adminSession";
import {
  buildStoredName,
  normalizedDisplayName,
  personDisplayName,
} from "./lib/personDisplay";
import { personGender } from "./lib/personModel";
import {
  applyVisitorContact,
  isPlausibleEmail,
} from "./lib/visitorContact";
import {
  visitorVisitDetailsValue,
} from "./lib/visitorVisitDetails";

const dateKeyRegex = /^\d{4}-\d{2}-\d{2}$/;

const publicVisitorStatus = v.union(
  v.literal("NV"),
  v.literal("RV"),
  v.literal("VO"),
);

const familyMemberValue = v.object({
  givenName: v.string(),
  surname: v.optional(v.string()),
  relationship: v.optional(v.string()),
});

function genderForApi(
  stored: "female" | "male" | undefined,
): "female" | "male" {
  return stored === "female" ? "female" : "male";
}

/** Normalise legacy roster status values (matches `people.listPeopleAdmin`). */
function statusForApi(
  stored: string,
): "M" | "M_U18" | "NV" | "RV" | "VO" {
  if (stored === "member") return "M";
  if (stored === "visitor") return "NV";
  return stored as "M" | "M_U18" | "NV" | "RV" | "VO";
}

function normalizedNameKey(givenName: string, surname: string): string {
  const g = givenName.trim();
  const s = surname.trim();
  const parts = [g, s].filter((x) => x.length > 0);
  return (parts.length > 0 ? parts.join(" ") : g).trim().toLowerCase();
}

/** Upsert or delete visitor contact row for a person when no contact data remains. */
export const upsertVisitorContact = mutation({
  args: {
    sessionToken: v.string(),
    personId: v.id("people"),
    phone: v.optional(v.string()),
    suburb: v.optional(v.string()),
    email: v.optional(v.string()),
    contactByEmail: v.optional(v.boolean()),
    contactByPhone: v.optional(v.boolean()),
    visitorVisitDetails: v.optional(visitorVisitDetailsValue),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken);
    const person = await ctx.db.get(args.personId);
    if (!person) {
      throw new Error("Person not found");
    }
    const emailTrim = args.email?.trim() ?? "";
    const phoneTrim = args.phone?.trim() ?? "";
    const contactByEmail = args.contactByEmail ?? false;
    const contactByPhone = args.contactByPhone ?? false;
    if (emailTrim.length > 0 && !isPlausibleEmail(emailTrim)) {
      throw new Error("Invalid email address");
    }
    if (contactByEmail && emailTrim.length === 0) {
      throw new Error("Add an email address when contact by email is selected");
    }
    if (contactByPhone && phoneTrim.length === 0) {
      throw new Error("Add a phone number when contact by phone is selected");
    }
    await applyVisitorContact(ctx, args.personId, {
      phone: args.phone,
      suburb: args.suburb,
      email: args.email,
      contactByEmail,
      contactByPhone,
      visitorVisitDetails: args.visitorVisitDetails,
    });
    return null;
  },
});

const visitorIntakeSummaryRow = v.object({
  personId: v.id("people"),
  displayName: v.string(),
  givenName: v.string(),
  surname: v.string(),
  gender: personGender,
  visitorStatus: publicVisitorStatus,
  /** Date of most recent attendance row for this person (visit date). */
  dateKey: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  suburb: v.optional(v.string()),
  contactByPhone: v.boolean(),
  contactByEmail: v.boolean(),
  /** Serialized family lines from visitor intake details. */
  familyWithMe: v.optional(v.string()),
  /** Checklist option ids from visitor intake details. */
  checklist: v.optional(v.array(v.string())),
});

/** Visitor roster rows with contact info and intake details (mirrors public intake fields). */
export const listVisitorIntakeSummaryAdmin = query({
  args: {
    sessionToken: v.string(),
    /** When set, only people with this visitor roster status (NV / RV / VO). Omit for all visitor types. */
    visitorStatus: v.optional(publicVisitorStatus),
  },
  returns: v.array(visitorIntakeSummaryRow),
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken);

    const people = await ctx.db.query("people").collect();
    const visitorPeople = people.filter((p) => {
      const s = statusForApi(p.status);
      if (s !== "NV" && s !== "RV" && s !== "VO") return false;
      if (args.visitorStatus !== undefined && s !== args.visitorStatus) {
        return false;
      }
      return true;
    });

    const attendance = await ctx.db.query("attendance").collect();
    const latestByPerson = new Map<
      Id<"people">,
      {
        dateKey: string;
        markedAt: number;
      }
    >();
    for (const row of attendance) {
      const prev = latestByPerson.get(row.personId);
      if (!prev || row.markedAt > prev.markedAt) {
        latestByPerson.set(row.personId, {
          dateKey: row.dateKey,
          markedAt: row.markedAt,
        });
      }
    }

    const visitorContactRows = await ctx.db.query("visitors").collect();
    const contactByPerson = new Map(
      visitorContactRows.map((r) => [r.personId, r]),
    );

    return visitorPeople
      .map((p) => {
        const vrow = contactByPerson.get(p._id);
        const latest = latestByPerson.get(p._id);
        const visitorStatus = statusForApi(p.status) as "NV" | "RV" | "VO";
        const familyWithMe = vrow?.visitorVisitDetails?.familyWithMe?.trim();
        const checklist = vrow?.visitorVisitDetails?.checklist;
        return {
          personId: p._id,
          displayName: personDisplayName(p),
          givenName: p.givenName ?? "",
          surname: p.surname ?? "",
          gender: genderForApi(p.gender),
          visitorStatus,
          dateKey: latest?.dateKey,
          phone: vrow?.phone,
          email: vrow?.email,
          suburb: vrow?.suburb,
          contactByPhone: vrow?.contactByPhone ?? false,
          contactByEmail: vrow?.contactByEmail ?? false,
          familyWithMe:
            familyWithMe && familyWithMe.length > 0 ? familyWithMe : undefined,
          checklist:
            checklist && checklist.length > 0 ? checklist : undefined,
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  },
});

/**
 * Public: register as a visitor with contact + intake fields (no admin session).
 * Matches an existing person by full display name (given + surname); otherwise creates a profile.
 */
export const submitPublicVisitorIntake = mutation({
  args: {
    givenName: v.string(),
    surname: v.string(),
    gender: personGender,
    visitorStatus: publicVisitorStatus,
    dateKey: v.string(),
    phone: v.optional(v.string()),
    suburb: v.optional(v.string()),
    email: v.optional(v.string()),
    contactByEmail: v.boolean(),
    contactByPhone: v.boolean(),
    familyMembers: v.array(familyMemberValue),
    visitorVisitDetails: v.optional(visitorVisitDetailsValue),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      createdProfile: v.boolean(),
    }),
    v.object({
      ok: v.literal(false),
      reason: v.union(
        v.literal("already_marked"),
        v.literal("invalid_date"),
        v.literal("invalid_name"),
        v.literal("invalid_email"),
        v.literal("invalid_contact"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    if (!dateKeyRegex.test(args.dateKey)) {
      return { ok: false as const, reason: "invalid_date" as const };
    }
    const givenName = args.givenName.trim();
    const surname = args.surname.trim();
    if (
      givenName.length < 1 ||
      givenName.length > 120 ||
      surname.length > 120
    ) {
      return { ok: false as const, reason: "invalid_name" as const };
    }

    const emailTrim = args.email?.trim() ?? "";
    if (emailTrim.length > 0 && !isPlausibleEmail(emailTrim)) {
      return { ok: false as const, reason: "invalid_email" as const };
    }
    if (args.contactByEmail && emailTrim.length === 0) {
      return { ok: false as const, reason: "invalid_contact" as const };
    }
    const phoneTrim = args.phone?.trim() ?? "";
    if (args.contactByPhone && phoneTrim.length === 0) {
      return { ok: false as const, reason: "invalid_contact" as const };
    }

    const everyone = await ctx.db.query("people").collect();
    const key = normalizedNameKey(givenName, surname);
    const existing = everyone.find(
      (p) => normalizedDisplayName(p).toLowerCase() === key,
    );

    let personId: Id<"people">;
    let createdProfile = false;
    if (existing) {
      personId = existing._id;
    } else {
      const name = buildStoredName(givenName, surname);
      personId = await ctx.db.insert("people", {
        name,
        givenName,
        surname,
        gender: args.gender,
        status: args.visitorStatus,
        createdAt: Date.now(),
      });
      createdProfile = true;
    }

    await applyVisitorContact(ctx, personId, {
      phone: args.phone,
      suburb: args.suburb,
      email: args.email,
      contactByEmail: args.contactByEmail,
      contactByPhone: args.contactByPhone,
      visitorVisitDetails: args.visitorVisitDetails,
    });

    const normalizedFamily = args.familyMembers
      .map((m) => ({
        givenName: m.givenName.trim(),
        surname: (m.surname ?? "").trim(),
        relationship: (m.relationship ?? "").trim(),
      }))
      .filter((m) => m.givenName.length > 0)
      .slice(0, 30);
    for (const m of normalizedFamily) {
      if (m.givenName.length > 120 || m.surname.length > 120 || m.relationship.length > 120) {
        return { ok: false as const, reason: "invalid_name" as const };
      }
    }

    const dup = await ctx.db
      .query("attendance")
      .withIndex("by_person_and_date", (q) =>
        q.eq("personId", personId).eq("dateKey", args.dateKey),
      )
      .first();
    if (dup) {
      return { ok: false as const, reason: "already_marked" as const };
    }

    const now = Date.now();
    await ctx.db.insert("attendance", {
      personId,
      dateKey: args.dateKey,
      markedAt: now,
      kind: "present",
    });

    const peopleByNormalizedName = new Map(
      everyone.map((p) => [normalizedDisplayName(p), p._id]),
    );
    peopleByNormalizedName.set(normalizedNameKey(givenName, surname), personId);
    const seenFamily = new Set<string>();
    for (const m of normalizedFamily) {
      const familyKey = normalizedNameKey(m.givenName, m.surname);
      if (!familyKey || seenFamily.has(familyKey) || familyKey === key) continue;
      seenFamily.add(familyKey);

      let familyPersonId = peopleByNormalizedName.get(familyKey);
      if (!familyPersonId) {
        const familyName = buildStoredName(m.givenName, m.surname);
        familyPersonId = await ctx.db.insert("people", {
          name: familyName,
          givenName: m.givenName,
          surname: m.surname,
          gender: args.gender,
          status: args.visitorStatus,
          createdAt: Date.now(),
        });
        peopleByNormalizedName.set(familyKey, familyPersonId);
      }

      const familyDup = await ctx.db
        .query("attendance")
        .withIndex("by_person_and_date", (q) =>
          q.eq("personId", familyPersonId!).eq("dateKey", args.dateKey),
        )
        .first();
      if (!familyDup) {
        await ctx.db.insert("attendance", {
          personId: familyPersonId,
          dateKey: args.dateKey,
          markedAt: Date.now(),
          kind: "present",
        });
      }
    }

    return { ok: true as const, createdProfile };
  },
});
