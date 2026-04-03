"use node";

import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, hashed] = parts;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  try {
    return timingSafeEqual(Buffer.from(hashed, "hex"), derived);
  } catch {
    return false;
  }
}

export const bootstrapFirstAdmin = action({
  args: {
    username: v.string(),
    password: v.string(),
  },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), reason: v.string() }),
  ),
  handler: async (ctx, args) => {
    const count = await ctx.runQuery(internal.admins.countAdmins, {});
    if (count > 0) {
      return { ok: false as const, reason: "An admin account already exists." };
    }
    if (args.username.length < 2) {
      return { ok: false as const, reason: "Username is too short." };
    }
    if (args.password.length < 8) {
      return {
        ok: false as const,
        reason: "Password must be at least 8 characters.",
      };
    }
    const passwordHash = await hashPassword(args.password);
    await ctx.runMutation(internal.admins.insertAdmin, {
      username: args.username.trim(),
      passwordHash,
    });
    return { ok: true as const };
  },
});

export const login = action({
  args: {
    username: v.string(),
    password: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    const admin = (await ctx.runQuery(internal.admins.getByUsername, {
      username: args.username.trim(),
    })) as { _id: Id<"admins">; passwordHash: string } | null;
    if (!admin) return null;
    const valid = await verifyPassword(args.password, admin.passwordHash);
    if (!valid) return null;
    return await ctx.runMutation(internal.sessions.createSession, {
      adminId: admin._id,
    });
  },
});
