import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config for PostgreSQL (Supabase) migration generation.
 * `generate` reads the schema and emits SQL into ./drizzle; migrations are
 * applied by src/migrate.ts.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
});
