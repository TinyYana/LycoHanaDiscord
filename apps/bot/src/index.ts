import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { Events } from "discord.js";
import { createDb, createRepositories } from "@lycohana/db";
import { loadEnv } from "./config/env";
import { buildRuntimeConfig } from "./config/runtime";
import { createLogger } from "./logger";
import { createClient } from "./discord/client";
import { registerCommands } from "./discord/register-commands";
import { createInteractionHandler } from "./discord/interaction-handler";
import { registerActivityTracking } from "./activity";
import { commands } from "./commands";
import type { CommandContext } from "./commands/types";

// .env lives at the monorepo root; resolve it regardless of the bot's cwd.
// __dirname is apps/bot/(src|dist), so three levels up is the repo root.
loadDotenv({ path: path.resolve(__dirname, "../../../.env") });

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);
  const config = buildRuntimeConfig(env);

  process.on("unhandledRejection", (reason) =>
    logger.error("unhandledRejection", { reason: String(reason) }),
  );
  process.on("uncaughtException", (error) => {
    logger.error("uncaughtException", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  });

  const db = createDb(env.DATABASE_URL);
  const repos = createRepositories(db);

  const client = createClient();
  const ctx: CommandContext = { logger, repos, config };

  registerActivityTracking(client, {
    repos,
    logger,
    limits: config.limits,
    timeZone: config.timeZone,
  });

  client.once(Events.ClientReady, (ready) => {
    logger.info("bot ready", { user: ready.user.tag, guilds: ready.guilds.cache.size });
  });
  client.on(Events.InteractionCreate, createInteractionHandler(commands, ctx));
  client.on(Events.Error, (error) => logger.error("client error", { error: error.message }));

  // Register slash commands first so they exist when the gateway connects.
  await registerCommands(env, commands, logger);
  await client.login(env.DISCORD_TOKEN);
}

main().catch((error) => {
  // Logger may not exist yet (e.g. env validation failed), so use console here.
  console.error("fatal: bot failed to start", error);
  process.exit(1);
});
