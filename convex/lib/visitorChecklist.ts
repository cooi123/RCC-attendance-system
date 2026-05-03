/** Allowed checklist keys stored on attendance visitor intake (keep in sync with `src/lib/visitorIntake.ts`). */
export const VISITOR_CHECKLIST_IDS = [
  "know_jesus",
  "know_church",
  "notify_on_events",
  "join_bible_study",
  "youth",
  "university",
  "young_adults",
  "family_north",
  "family_west",
  "family_east",
] as const;

export type VisitorChecklistId = (typeof VISITOR_CHECKLIST_IDS)[number];

const allowed = new Set<string>(VISITOR_CHECKLIST_IDS);

export function normalizeVisitorChecklist(raw: string[] | undefined): string[] {
  if (!raw?.length) return [];
  const out: string[] = [];
  for (const id of raw) {
    const s = id.trim();
    if (!allowed.has(s) || out.includes(s)) continue;
    out.push(s);
    if (out.length >= 24) break;
  }
  return out;
}
