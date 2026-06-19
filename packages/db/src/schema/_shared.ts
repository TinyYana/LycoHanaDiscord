import { integer } from "drizzle-orm/sqlite-core";

/**
 * Fresh `created_at` / `updated_at` columns (unix-timestamp integers,
 * surfaced as `Date`). Returned from a function so each table gets its own
 * column builders instead of sharing instances.
 */
export function timestamps() {
  return {
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  };
}
