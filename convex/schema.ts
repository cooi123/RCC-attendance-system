import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { personGender, personRosterStatus } from "./lib/personModel";

/**
 * MIGRATION PERIOD: accepts both the current status values and the legacy
 * "visitor" / "member" values that existed before the member-model refactor.
 * Once `migrations:runAll` has been executed against production and all rows
 * have been converted, replace this with the plain `personRosterStatus`
 * validator and remove the two legacy literals.
 */
const personRosterStatusWidened = v.union(
  personRosterStatus,
  v.literal("visitor"),
  v.literal("member"),
);

export default defineSchema({
  admins: defineTable({
    username: v.string(),
    passwordHash: v.string(),
  }).index("by_username", ["username"]),

  sessions: defineTable({
    adminId: v.id("admins"),
    token: v.string(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  teams: defineTable({
    name: v.string(),
  }).index("by_name", ["name"]),

  people: defineTable({
    /** Denormalized full name for search / legacy rows / exports. */
    name: v.string(),
    givenName: v.optional(v.string()),
    surname: v.optional(v.string()),
    gender: v.optional(personGender),
    teamId: v.optional(v.id("teams")),
    status: personRosterStatusWidened,
    createdAt: v.number(),
    /** Opaque token for personal check-in URL / QR (optional until generated). */
    checkInToken: v.optional(v.string()),
  })
    .index("by_team", ["teamId"])
    .index("by_name", ["name"])
    .index("by_check_in_token", ["checkInToken"]),

  /** Visitor contact details keyed by person (NV/RV/VO roster). */
  visitors: defineTable({
    personId: v.id("people"),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    suburb: v.optional(v.string()),
    /** Visitor opted in to follow-up via email. */
    contactByEmail: v.optional(v.boolean()),
    /** Visitor opted in to follow-up via phone. */
    contactByPhone: v.optional(v.boolean()),
    /** Visitor intake details from the latest submission. */
    visitorVisitDetails: v.optional(
      v.object({
        familyWithMe: v.optional(v.string()),
        knowMoreAbout: v.optional(v.string()),
        checklist: v.optional(v.array(v.string())),
      }),
    ),
    updatedAt: v.number(),
  }).index("by_person", ["personId"]),

  attendance: defineTable({
    personId: v.id("people"),
    dateKey: v.string(),
    markedAt: v.number(),
    /** Omitted on legacy rows: treated as present. */
    kind: v.optional(
      v.union(
        v.literal("present"),
        v.literal("sick"),
        v.literal("holiday"),
        v.literal("work"),
        v.literal("other"),
        v.literal("unexcused"),
      ),
    ),
    /** Optional detail when kind is `other`. */
    absenceNote: v.optional(v.string()),
    /** Legacy: visitor intake details now live on `visitors.visitorVisitDetails`. */
    visitorVisitDetails: v.optional(
      v.object({
        familyWithMe: v.optional(v.string()),
        knowMoreAbout: v.optional(v.string()),
        checklist: v.optional(v.array(v.string())),
      }),
    ),
  })
    .index("by_person", ["personId"])
    .index("by_date", ["dateKey"])
    .index("by_person_and_date", ["personId", "dateKey"]),
});
