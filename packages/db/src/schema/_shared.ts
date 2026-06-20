import { timestamp } from "drizzle-orm/pg-core";

/**
 * Fresh `created_at` / `updated_at` columns (timestamptz, surfaced as `Date`).
 * Returned from a function so each table gets its own column builders instead
 * of sharing instances.
 */
export function timestamps() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  };
}
