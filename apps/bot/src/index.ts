import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { DB_PACKAGE } from "@lycohana/db";
import { DOMAIN_PACKAGE } from "@lycohana/domain";
import { loadEnv } from "./config/env";

// .env lives at the monorepo root; resolve it regardless of the bot's cwd.
// __dirname is apps/bot/(src|dist), so three levels up is the repo root.
loadDotenv({ path: path.resolve(__dirname, "../../../.env") });

function main(): void {
  const env = loadEnv();

  // M0 skeleton: prove env loads and the workspace packages resolve.
  // The Discord client and slash commands arrive in M2.
  console.log("[lycohana-bot] M0 skeleton ready");
  console.log(`  NODE_ENV     = ${env.NODE_ENV}`);
  console.log(`  LOG_LEVEL    = ${env.LOG_LEVEL}`);
  console.log(`  DATABASE_URL = ${env.DATABASE_URL}`);
  console.log(`  CLIENT_ID    = ${env.DISCORD_CLIENT_ID}`);
  console.log(`  workspaces   = ${DOMAIN_PACKAGE}, ${DB_PACKAGE}`);
}

main();
