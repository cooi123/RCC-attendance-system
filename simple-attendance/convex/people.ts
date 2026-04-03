import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { allocateUniqueCheckInToken } from "./lib/checkInToken";
import { requireAdminSession } from "./lib/adminSession";

const personPublic = v.object({
  _id: v.id("people"),
  name: v.string(),
  status: v.union(v.literal("visitor"), v.literal("member")),
});

export const listPeoplePublic = query({
  args: {},
  returns: v.array(personPublic),
  handler: async (ctx) => {
    const people = await ctx.db.query("people").collect();
    return people
      .map((p) => ({
        _id: p._id,
        name: p.name,
        status: p.status,
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
      teamId: v.optional(v.id("teams")),
      teamName: v.optional(v.string()),
      status: v.union(v.literal("visitor"), v.literal("member")),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken);
    const people = await ctx.db.query("people").collect();
    const teams = await ctx.db.query("teams").collect();
    const teamById = new Map(teams.map((t) => [t._id, t.name]));
    return people
      .map((p) => ({
        _id: p._id,
        name: p.name,
        teamId: p.teamId,
        teamName: p.teamId ? teamById.get(p.teamId) : undefined,
        status: p.status,
        createdAt: p.createdAt,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const createPerson = mutation({
  args: {
    sessionToken: v.string(),
    name: v.string(),
    teamId: v.optional(v.id("teams")),
    status: v.union(v.literal("visitor"), v.literal("member")),
  },
  returns: v.id("people"),
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken);
    const name = args.name.trim();
    if (name.length === 0) throw new Error("Name is required");
    return await ctx.db.insert("people", {
      name,
      teamId: args.teamId,
      status: args.status,
      createdAt: Date.now(),
    });
  },
});

export const updatePerson = mutation({
  args: {
    sessionToken: v.string(),
    personId: v.id("people"),
    name: v.string(),
    teamId: v.optional(v.id("teams")),
    status: v.union(v.literal("visitor"), v.literal("member")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken);
    const name = args.name.trim();
    if (name.length === 0) throw new Error("Name is required");
    await ctx.db.patch(args.personId, {
      name,
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
    await ctx.db.delete(args.personId);
    return null;
  },
});

export const setPersonStatus = mutation({
  args: {
    sessionToken: v.string(),
    personId: v.id("people"),
    status: v.union(v.literal("visitor"), v.literal("member")),
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
