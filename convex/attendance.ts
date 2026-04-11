import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  normalizedDisplayName,
  personDisplayName,
} from "./lib/personDisplay";
import { personRosterStatus } from "./lib/personModel";

/** Normalise legacy "visitor"/"member" status values from pre-migration rows. */
function statusForApi(
  stored: string,
): "M" | "M_U18" | "NV" | "RV" | "VO" {
  if (stored === "member") return "M";
  if (stored === "visitor") return "NV";
  return stored as "M" | "M_U18" | "NV" | "RV" | "VO";
}
import { requireAdminSession } from "./lib/adminSession";

const dateKeyRegex = /^\d{4}-\d{2}-\d{2}$/;

const attendanceKindInDb = v.union(
  v.literal("present"),
  v.literal("sick"),
  v.literal("holiday"),
  v.literal("work"),
  v.literal("other"),
  v.literal("unexcused"),
);

/** Single-day status for API responses (no row, present, or absence). */
const attendanceDayStatus = v.union(
  v.literal("none"),
  attendanceKindInDb,
);

/** Resolved attendance row kind (legacy rows omit `kind` → present). */
type AttendanceKindResolved = NonNullable<Doc<"attendance">["kind"]>;

function recordKind(row: Doc<"attendance">): AttendanceKindResolved {
  return row.kind ?? "present";
}

function dayStatusFromRow(
  row: Doc<"attendance"> | undefined,
): "none" | NonNullable<Doc<"attendance">["kind"]> {
  if (!row) return "none";
  const k = recordKind(row);
  return k;
}

export const markAttendance = mutation({
  args: {
    personId: v.id("people"),
    dateKey: v.string(),
  },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({
      ok: v.literal(false),
      reason: v.union(
        v.literal("already_marked"),
        v.literal("invalid_date"),
        v.literal("not_found"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    if (!dateKeyRegex.test(args.dateKey)) {
      return { ok: false as const, reason: "invalid_date" as const };
    }
    const person = await ctx.db.get(args.personId);
    if (!person) {
      return { ok: false as const, reason: "not_found" as const };
    }
    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_person_and_date", (q) =>
        q.eq("personId", args.personId).eq("dateKey", args.dateKey),
      )
      .first();
    if (existing) {
      return { ok: false as const, reason: "already_marked" as const };
    }
    await ctx.db.insert("attendance", {
      personId: args.personId,
      dateKey: args.dateKey,
      markedAt: Date.now(),
      kind: "present",
    });
    return { ok: true as const };
  },
});

/** Resolve by name (case-insensitive) or create a visitor, then mark attendance. */
export const checkInByName = mutation({
  args: {
    name: v.string(),
    dateKey: v.string(),
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
      ),
    }),
  ),
  handler: async (ctx, args) => {
    if (!dateKeyRegex.test(args.dateKey)) {
      return { ok: false as const, reason: "invalid_date" as const };
    }
    const trimmed = args.name.trim();
    if (trimmed.length < 1 || trimmed.length > 120) {
      return { ok: false as const, reason: "invalid_name" as const };
    }
    const lower = trimmed.toLowerCase();
    const everyone = await ctx.db.query("people").collect();
    const existing = everyone.find((p) => normalizedDisplayName(p) === lower);
    let personId: Id<"people">;
    let createdProfile = false;
    if (existing) {
      personId = existing._id;
    } else {
      personId = await ctx.db.insert("people", {
        name: trimmed,
        givenName: trimmed,
        surname: "",
        gender: "male",
        status: "NV",
        createdAt: Date.now(),
      });
      createdProfile = true;
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
    await ctx.db.insert("attendance", {
      personId,
      dateKey: args.dateKey,
      markedAt: Date.now(),
      kind: "present",
    });
    return { ok: true as const, createdProfile };
  },
});

const personCheckInRow = v.object({
  _id: v.id("people"),
  name: v.string(),
  status: personRosterStatus,
  attendanceToday: attendanceDayStatus,
});

/** Public: roster for self check-in, with attendance state for `dateKey`. */
export const listPeopleForPublicCheckIn = query({
  args: { dateKey: v.string() },
  returns: v.array(personCheckInRow),
  handler: async (ctx, args) => {
    if (!dateKeyRegex.test(args.dateKey)) {
      throw new Error("Invalid date");
    }
    const people = await ctx.db.query("people").collect();
    const attendanceToday = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.eq("dateKey", args.dateKey))
      .collect();
    const statusByPerson = new Map<Id<"people">, Doc<"attendance">>();
    for (const a of attendanceToday) {
      statusByPerson.set(a.personId, a);
    }
    return people
      .map((p) => ({
        _id: p._id,
        name: personDisplayName(p),
        status: statusForApi(p.status),
        attendanceToday: dayStatusFromRow(statusByPerson.get(p._id)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

const checkInManyOk = v.object({
  ok: v.literal(true),
  checkedIn: v.array(
    v.object({
      personId: v.id("people"),
      name: v.string(),
    }),
  ),
  alreadyMarked: v.array(
    v.object({
      personId: v.id("people"),
      name: v.string(),
    }),
  ),
});

/** Public: mark attendance for multiple existing people in one request (e.g. family). */
export const checkInManyByPersonIds = mutation({
  args: {
    personIds: v.array(v.id("people")),
    dateKey: v.string(),
  },
  returns: v.union(
    checkInManyOk,
    v.object({
      ok: v.literal(false),
      reason: v.union(v.literal("invalid_date"), v.literal("too_many")),
    }),
  ),
  handler: async (ctx, args) => {
    if (!dateKeyRegex.test(args.dateKey)) {
      return { ok: false as const, reason: "invalid_date" as const };
    }
    const unique = [...new Set(args.personIds)];
    if (unique.length > 100) {
      return { ok: false as const, reason: "too_many" as const };
    }
    const checkedIn: Array<{ personId: Id<"people">; name: string }> = [];
    const alreadyMarked: Array<{ personId: Id<"people">; name: string }> = [];
    const now = Date.now();
    for (const personId of unique) {
      const person = await ctx.db.get(personId);
      if (!person) {
        continue;
      }
      const existing = await ctx.db
        .query("attendance")
        .withIndex("by_person_and_date", (q) =>
          q.eq("personId", personId).eq("dateKey", args.dateKey),
        )
        .first();
      if (existing) {
        alreadyMarked.push({
          personId,
          name: personDisplayName(person),
        });
      } else {
        await ctx.db.insert("attendance", {
          personId,
          dateKey: args.dateKey,
          markedAt: now,
          kind: "present",
        });
        checkedIn.push({ personId, name: personDisplayName(person) });
      }
    }
    return { ok: true as const, checkedIn, alreadyMarked };
  },
});

export const listAttendanceAdmin = query({
  args: {
    sessionToken: v.string(),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      _id: v.id("attendance"),
      personId: v.id("people"),
      personName: v.string(),
      teamName: v.optional(v.string()),
      dateKey: v.string(),
      markedAt: v.number(),
      kind: attendanceKindInDb,
      absenceNote: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken);
    let rows = await ctx.db.query("attendance").collect();
    if (args.dateFrom) {
      rows = rows.filter((r) => r.dateKey >= args.dateFrom!);
    }
    if (args.dateTo) {
      rows = rows.filter((r) => r.dateKey <= args.dateTo!);
    }
    rows.sort((a, b) => {
      const d = b.dateKey.localeCompare(a.dateKey);
      if (d !== 0) return d;
      return b.markedAt - a.markedAt;
    });
    const people = await ctx.db.query("people").collect();
    const peopleMap = new Map(people.map((p) => [p._id, p]));
    const teams = await ctx.db.query("teams").collect();
    const teamMap = new Map(teams.map((t) => [t._id, t.name]));
    return rows.map((r) => {
      const p = peopleMap.get(r.personId);
      return {
        _id: r._id,
        personId: r.personId,
        personName: p ? personDisplayName(p) : "Unknown",
        teamName: p?.teamId ? teamMap.get(p.teamId) : undefined,
        dateKey: r.dateKey,
        markedAt: r.markedAt,
        kind: recordKind(r),
        absenceNote: r.absenceNote,
      };
    });
  },
});


/** Roster with per-day attendance status for each date in dayKeys (admin). Days can be any dates (need not be consecutive). */
export const listRosterWeekAttendanceAdmin = query({
  args: {
    sessionToken: v.string(),
    dayKeys: v.array(v.string()),
  },
  returns: v.object({
    rows: v.array(
      v.object({
        personId: v.id("people"),
        name: v.string(),
        teamName: v.optional(v.string()),
        dayStatus: v.array(attendanceDayStatus),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken);
    if (args.dayKeys.length < 1) {
      throw new Error("Expected at least one day");
    }
    for (const k of args.dayKeys) {
      if (!dateKeyRegex.test(k)) {
        throw new Error("Invalid date");
      }
    }

    const people = await ctx.db.query("people").collect();
    const teams = await ctx.db.query("teams").collect();
    const teamById = new Map(teams.map((t) => [t._id, t.name]));

    const statusByPersonDay = new Map<string, Doc<"attendance">>();
    for (const dk of args.dayKeys) {
      const dayRows = await ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.eq("dateKey", dk))
        .collect();
      for (const r of dayRows) {
        statusByPersonDay.set(`${r.personId}|${dk}`, r);
      }
    }

    const rows = people
      .sort((a, b) =>
        personDisplayName(a).localeCompare(personDisplayName(b)),
      )
      .map((p) => ({
        personId: p._id,
        name: personDisplayName(p),
        teamName: p.teamId ? teamById.get(p.teamId) : undefined,
        dayStatus: args.dayKeys.map((dk) =>
          dayStatusFromRow(statusByPersonDay.get(`${p._id}|${dk}`)),
        ),
      }));

    return { rows };
  },
});

export const setAttendanceOverride = mutation({
  args: {
    sessionToken: v.string(),
    personId: v.id("people"),
    dateKey: v.string(),
    status: v.union(
      v.literal("present"),
      v.literal("clear"),
      v.literal("sick"),
      v.literal("holiday"),
      v.literal("work"),
      v.literal("other"),
      v.literal("unexcused"),
    ),
    absenceNote: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken);
    if (!dateKeyRegex.test(args.dateKey)) {
      throw new Error("Invalid date");
    }
    const person = await ctx.db.get(args.personId);
    if (!person) {
      throw new Error("Person not found");
    }
    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_person_and_date", (q) =>
        q.eq("personId", args.personId).eq("dateKey", args.dateKey),
      )
      .first();

    if (args.status === "clear") {
      if (existing) {
        await ctx.db.delete(existing._id);
      }
      return null;
    }

    const now = Date.now();
    const trimmedNote = args.absenceNote?.trim();
    const note =
      args.status === "other" && trimmedNote && trimmedNote.length > 0
        ? trimmedNote.slice(0, 500)
        : undefined;

    if (args.status === "present") {
      const doc = {
        personId: args.personId,
        dateKey: args.dateKey,
        markedAt: now,
        kind: "present" as const,
      };
      if (existing) {
        await ctx.db.replace(existing._id, doc);
      } else {
        await ctx.db.insert("attendance", doc);
      }
      return null;
    }

    const absentDoc =
      note !== undefined
        ? {
            personId: args.personId,
            dateKey: args.dateKey,
            markedAt: now,
            kind: args.status,
            absenceNote: note,
          }
        : {
            personId: args.personId,
            dateKey: args.dateKey,
            markedAt: now,
            kind: args.status,
          };
    if (existing) {
      await ctx.db.replace(existing._id, absentDoc);
    } else {
      await ctx.db.insert("attendance", absentDoc);
    }
    return null;
  },
});
