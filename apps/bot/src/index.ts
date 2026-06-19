import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { loadEnv } from "./config/env";

// .env lives at the monorepo root; resolve it regardless of the bot's cwd.
// __dirname is apps/bot/(src|dist), so three levels up is the repo root.
loadDotenv({ path: path.resolve(__dirname, "../../../.env") });

function bootstrap(): void {
  // Validate configuration up front so a misconfigured deploy fails fast
  // instead of crashing later. The Discord client, event handlers and
  // slash-command registration are wired up in M2.
  loadEnv();
}

bootstrap();
