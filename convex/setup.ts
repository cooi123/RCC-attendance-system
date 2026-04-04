import { query } from "./_generated/server";
import { v } from "convex/values";

export const hasAnyAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const first = await ctx.db.query("admins").first();
    return first !== null;
  },
});
