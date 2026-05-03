import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  normalizeVisitorVisitDetails,
  type VisitorVisitDetailsInput,
} from "./visitorVisitDetails";

export type VisitorContactInput = {
  phone?: string | undefined;
  suburb?: string | undefined;
  email?: string | undefined;
  contactByEmail: boolean;
  contactByPhone: boolean;
  visitorVisitDetails?: VisitorVisitDetailsInput;
};

/** Insert, update, or remove the `visitors` row for this person. */
export async function applyVisitorContact(
  ctx: MutationCtx,
  personId: Id<"people">,
  input: VisitorContactInput,
): Promise<void> {
  const phone = input.phone?.trim().slice(0, 40) || undefined;
  const suburb = input.suburb?.trim().slice(0, 120) || undefined;
  const email = input.email?.trim().slice(0, 254).toLowerCase() || undefined;
  const contactByEmail = input.contactByEmail;
  const contactByPhone = input.contactByPhone;
  const visitorVisitDetails = normalizeVisitorVisitDetails(
    input.visitorVisitDetails,
  );

  const hasAny =
    phone !== undefined ||
    suburb !== undefined ||
    email !== undefined ||
    contactByEmail ||
    contactByPhone ||
    visitorVisitDetails !== undefined;

  const now = Date.now();
  const existing = await ctx.db
    .query("visitors")
    .withIndex("by_person", (q) => q.eq("personId", personId))
    .first();

  if (!hasAny) {
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return;
  }

  const doc = {
    personId,
    phone,
    email,
    suburb,
    contactByEmail,
    contactByPhone,
    visitorVisitDetails,
    updatedAt: now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, doc);
  } else {
    await ctx.db.insert("visitors", doc);
  }
}

/** Lenient email check when non-empty (Convex mutation validation). */
export function isPlausibleEmail(raw: string): boolean {
  const s = raw.trim();
  if (s.length < 3 || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
