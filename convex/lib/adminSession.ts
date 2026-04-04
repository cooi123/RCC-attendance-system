import type {
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import type { DataModel } from "../_generated/dataModel";

type Ctx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;

export async function requireAdminSession(ctx: Ctx, sessionToken: string) {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", sessionToken))
    .first();
  if (!session) {
    throw new Error("Unauthorized");
  }
  if (session.expiresAt <= Date.now()) {
    throw new Error("Session expired");
  }
  return session.adminId;
}
