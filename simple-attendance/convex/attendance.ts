import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireAdminSession } from "./lib/adminSession";

const dateKeyRegex = /^\d{4}-\d{2}-\d{2}$/;

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
    const existing = everyone.find(
      (p) => p.name.trim().toLowerCase() === lower,
    );
    let personId: Id<"people">;
    let createdProfile = false;
    if (existing) {
      personId = existing._id;
    } else {
      personId = await ctx.db.insert("people", {
        name: trimmed,
        status: "visitor",
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
    });
    return { ok: true as const, createdProfile };
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
        personName: p?.name ?? "Unknown",
        teamName: p?.teamId ? teamMap.get(p.teamId) : undefined,
        dateKey: r.dateKey,
        markedAt: r.markedAt,
      };
    });
  },
});

function ordinalDayUtc(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

/** Roster with present/absent for each date in dayKeys (admin). Dates must be consecutive when more than one. */
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
        present: v.array(v.boolean()),
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
    const ordinals = args.dayKeys.map((k) => ordinalDayUtc(k));
    for (let i = 1; i < args.dayKeys.length; i++) {
      if (ordinals[i]! - ordinals[i - 1]! !== 1) {
        throw new Error("Days must be consecutive");
      }
    }

    const people = await ctx.db.query("people").collect();
    const teams = await ctx.db.query("teams").collect();
    const teamById = new Map(teams.map((t) => [t._id, t.name]));

    const presentSet = new Set<string>();
    for (const dk of args.dayKeys) {
      const dayRows = await ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.eq("dateKey", dk))
        .collect();
      for (const r of dayRows) {
        presentSet.add(`${r.personId}|${dk}`);
      }
    }

    const rows = people
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({
        personId: p._id,
        name: p.name,
        teamName: p.teamId ? teamById.get(p.teamId) : undefined,
        present: args.dayKeys.map((dk) => presentSet.has(`${p._id}|${dk}`)),
      }));

    return { rows };
  },
});

export const setAttendanceOverride = mutation({
  args: {
    sessionToken: v.string(),
    personId: v.id("people"),
    dateKey: v.string(),
    present: v.boolean(),
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
    if (args.present) {
      if (!existing) {
        await ctx.db.insert("attendance", {
          personId: args.personId,
          dateKey: args.dateKey,
          markedAt: Date.now(),
        });
      }
    } else if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});
