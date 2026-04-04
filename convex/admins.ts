import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getByUsername = internalQuery({
  args: { username: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("admins"),
      username: v.string(),
      passwordHash: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("admins")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();
    if (!admin) return null;
    return {
      _id: admin._id,
      username: admin.username,
      passwordHash: admin.passwordHash,
    };
  },
});

export const insertAdmin = internalMutation({
  args: {
    username: v.string(),
    passwordHash: v.string(),
  },
  returns: v.id("admins"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("admins", {
      username: args.username,
      passwordHash: args.passwordHash,
    });
  },
});

export const countAdmins = internalQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const all = await ctx.db.query("admins").collect();
    return all.length;
  },
});
