import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
    name: v.string(),
    teamId: v.optional(v.id("teams")),
    status: v.union(v.literal("visitor"), v.literal("member")),
    createdAt: v.number(),
    /** Opaque token for personal check-in URL / QR (optional until generated). */
    checkInToken: v.optional(v.string()),
  })
    .index("by_team", ["teamId"])
    .index("by_name", ["name"])
    .index("by_check_in_token", ["checkInToken"]),

  attendance: defineTable({
    personId: v.id("people"),
    dateKey: v.string(),
    markedAt: v.number(),
  })
    .index("by_person", ["personId"])
    .index("by_date", ["dateKey"])
    .index("by_person_and_date", ["personId", "dateKey"]),
});
