import { v } from "convex/values";
import { normalizeVisitorChecklist } from "./visitorChecklist";

export const visitorVisitDetailsValue = v.object({
  familyWithMe: v.optional(v.string()),
  knowMoreAbout: v.optional(v.string()),
  checklist: v.optional(v.array(v.string())),
});

export type VisitorVisitDetailsInput = {
  familyWithMe?: string;
  knowMoreAbout?: string;
  checklist?: string[];
};

export function normalizeVisitorVisitDetails(
  raw: VisitorVisitDetailsInput | undefined,
):
  | VisitorVisitDetailsInput
  | undefined {
  if (!raw) return undefined;
  const fm = raw.familyWithMe?.trim().slice(0, 600);
  const km = raw.knowMoreAbout?.trim().slice(0, 2000);
  const checklist = normalizeVisitorChecklist(raw.checklist);
  const familyWithMe = fm && fm.length > 0 ? fm : undefined;
  const knowMoreAbout = km && km.length > 0 ? km : undefined;
  const cl = checklist.length > 0 ? checklist : undefined;
  if (!familyWithMe && !knowMoreAbout && !cl) return undefined;
  return {
    ...(familyWithMe !== undefined ? { familyWithMe } : {}),
    ...(knowMoreAbout !== undefined ? { knowMoreAbout } : {}),
    ...(cl !== undefined ? { checklist: cl } : {}),
  };
}
