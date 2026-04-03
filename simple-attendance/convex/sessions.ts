import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const createSession = internalMutation({
  args: { adminId: v.id("admins") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const token = randomToken();
    await ctx.db.insert("sessions", {
      adminId: args.adminId,
      token,
      expiresAt: Date.now() + SESSION_MS,
    });
    return token;
  },
});

export const logout = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .first();
    if (session) {
      await ctx.db.delete(session._id);
    }
    return null;
  },
});
