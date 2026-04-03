import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminSession } from "./lib/adminSession";

export const listTeams = query({
  args: { sessionToken: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("teams"),
      name: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken);
    const teams = await ctx.db.query("teams").collect();
    return teams.map((t) => ({ _id: t._id, name: t.name }));
  },
});

export const createTeam = mutation({
  args: { sessionToken: v.string(), name: v.string() },
  returns: v.id("teams"),
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken);
    const name = args.name.trim();
    if (name.length === 0) throw new Error("Team name is required");
    return await ctx.db.insert("teams", { name });
  },
});

export const renameTeam = mutation({
  args: {
    sessionToken: v.string(),
    teamId: v.id("teams"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken);
    const name = args.name.trim();
    if (name.length === 0) throw new Error("Team name is required");
    await ctx.db.patch(args.teamId, { name });
    return null;
  },
});

export const deleteTeam = mutation({
  args: { sessionToken: v.string(), teamId: v.id("teams") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminSession(ctx, args.sessionToken);
    const members = await ctx.db
      .query("people")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();
    for (const p of members) {
      await ctx.db.patch(p._id, { teamId: undefined });
    }
    await ctx.db.delete(args.teamId);
    return null;
  },
});
