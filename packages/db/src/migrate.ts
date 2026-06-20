import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Load the monorepo-root .env so `pnpm db:migrate` picks up DATABASE_URL.
loadDotenv({ path: path.resolve(__dirname, "../../../.env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[db] DATABASE_URL is not set");
  process.exit(1);
}

const migrationsFolder = path.resolve(__dirname, "../drizzle");

// A dedicated single connection for migrations (recommended for the migrator).
const client = postgres(databaseUrl, { ssl: "require", prepare: false, max: 1 });
const db = drizzle(client);

migrate(db, { migrationsFolder })
  .then(async () => {
    console.log("[db] migrations applied");
    await client.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[db] migration failed:", error);
    await client.end();
    process.exit(1);
  });
