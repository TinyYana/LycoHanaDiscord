import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// packages/db/(src|dist) -> monorepo root.
const REPO_ROOT = path.resolve(__dirname, "../../..");

/**
 * Accepts either a libsql URL (`file:`, `libsql://`, `http(s)://`, …) or a
 * bare filesystem path. Bare paths are treated as local SQLite files and are
 * anchored to the monorepo root, so a relative DATABASE_URL resolves to the
 * same file regardless of which package's cwd launched the process.
 */
function normalizeUrl(databaseUrl: string): string {
  if (databaseUrl.includes("://") || databaseUrl.startsWith("file:")) return databaseUrl;
  const abs = path.isAbsolute(databaseUrl) ? databaseUrl : path.resolve(REPO_ROOT, databaseUrl);
  return `file:${abs}`;
}

export type Db = ReturnType<typeof createDb>;

/** Create a Drizzle client backed by libsql (SQLite). */
export function createDb(databaseUrl: string) {
  const url = normalizeUrl(databaseUrl);

  // Ensure the parent directory exists for local file databases.
  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const client = createClient({ url });
  return drizzle(client, { schema });
}
