import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb } from "./client";

// Load the monorepo-root .env so `pnpm db:migrate` picks up DATABASE_URL.
loadDotenv({ path: path.resolve(__dirname, "../../../.env") });

const databaseUrl = process.env.DATABASE_URL ?? "./data/lycohana.db";
const migrationsFolder = path.resolve(__dirname, "../drizzle");

const db = createDb(databaseUrl);

migrate(db, { migrationsFolder })
  .then(() => {
    console.log(`[db] migrations applied (${databaseUrl})`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("[db] migration failed:", error);
    process.exit(1);
  });
