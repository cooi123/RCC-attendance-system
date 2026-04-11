import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api.js";
import type { DataModel } from "./_generated/dataModel.js";

export const migrations = new Migrations<DataModel>(components.migrations);

/**
 * Run all migrations in order. Called by the CI deploy pipeline with:
 *   npx convex run migrations:runAll --prod
 */
export const runAll = migrations.runner([
  internal.migrations.normalizePeopleStatus,
  internal.migrations.backfillPeopleNames,
]);

/**
 * Convert legacy `people.status` values to the new member-model enum.
 *
 *   "member"  → "M"   (full member)
 *   "visitor" → "NV"  (non-voting / visitor)
 *
 * After this migration completes and is confirmed you can remove the two
 * legacy literals from `personRosterStatusWidened` in schema.ts and switch
 * the field back to plain `personRosterStatus`.
 */
export const normalizePeopleStatus = migrations.define({
  table: "people",
  migrateOne: async (ctx, person) => {
    if (person.status === "member") {
      await ctx.db.patch(person._id, { status: "M" });
    } else if (person.status === "visitor") {
      await ctx.db.patch(person._id, { status: "NV" });
    }
  },
});

/**
 * Backfill `givenName` and `surname` for legacy rows that were created
 * before the member-model refactor (they only have a flat `name` field).
 * Also defaults `gender` to "male" when absent.
 *
 * The split heuristic: everything before the last space → givenName,
 * last word → surname. Single-word names become givenName with empty surname.
 */
export const backfillPeopleNames = migrations.define({
  table: "people",
  migrateOne: async (ctx, person) => {
    if (person.givenName !== undefined && person.surname !== undefined) {
      // Already migrated – nothing to do.
      return;
    }
    const full = person.name.trim();
    const lastSpace = full.lastIndexOf(" ");
    const givenName =
      lastSpace === -1 ? full : full.slice(0, lastSpace).trim();
    const surname = lastSpace === -1 ? "" : full.slice(lastSpace + 1).trim();
    await ctx.db.patch(person._id, {
      givenName: givenName || full,
      surname,
      gender: person.gender ?? "male",
    });
  },
});
