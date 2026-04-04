import type { MutationCtx } from "../_generated/server";

function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const MAX_ATTEMPTS = 8;

export async function allocateUniqueCheckInToken(
  ctx: MutationCtx,
): Promise<string> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const token = randomToken();
    const existing = await ctx.db
      .query("people")
      .withIndex("by_check_in_token", (q) => q.eq("checkInToken", token))
      .first();
    if (!existing) {
      return token;
    }
  }
  throw new Error("Could not allocate a unique check-in token");
}
