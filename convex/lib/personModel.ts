import { v } from "convex/values";

/** Roster role / membership category. */
export const personRosterStatus = v.union(
  v.literal("M"),
  v.literal("M_U18"),
  v.literal("NV"),
  v.literal("RV"),
  v.literal("VO"),
);

export const personGender = v.union(
  v.literal("female"),
  v.literal("male"),
);
