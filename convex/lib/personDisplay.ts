import type { Doc } from "../_generated/dataModel";

/** Full name for UI, exports, and matching — prefers givenName + surname when set. */
export function personDisplayName(p: Doc<"people">): string {
  const g = (p.givenName ?? "").trim();
  const s = (p.surname ?? "").trim();
  const parts = [g, s].filter((x) => x.length > 0);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return p.name.trim();
}

export function normalizedDisplayName(p: Doc<"people">): string {
  return personDisplayName(p).trim().toLowerCase();
}

export function buildStoredName(givenName: string, surname: string): string {
  const g = givenName.trim();
  const s = surname.trim();
  if (!g) {
    throw new Error("Given name is required");
  }
  return s.length > 0 ? `${g} ${s}` : g;
}
