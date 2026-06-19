import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config for SQLite migration generation. `generate` reads the
 * schema and emits SQL into ./drizzle; migrations are applied by src/migrate.ts.
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
});
