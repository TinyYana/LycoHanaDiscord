import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

/**
 * Create a Drizzle client backed by postgres.js, pointed at a PostgreSQL
 * connection string (Supabase). SSL is required by Supabase; `prepare: false`
 * keeps it compatible with the transaction pooler (port 6543) as well as a
 * direct connection (port 5432).
 */
export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl, { ssl: "require", prepare: false });
  return drizzle(client, { schema });
}
