import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { loadEnv } from "./config/env";
import { buildRuntimeConfig, REPO_ROOT } from "./config/runtime";
import { createLogger } from "./logger";
import { syncCommands } from "./discord/register-commands";
import { createCommands } from "./commands";
import { EmbedDraftStore } from "./embed-draft";
import { createMessages } from "./messages";

/**
 * Operator entry point: force-push slash-command definitions to Discord
 * (`pnpm commands:register`) and record their hash, so the bot's `auto` mode
 * will not push them again. Guild-scoped when DISCORD_GUILD_ID is set,
 * otherwise global. Does not log the bot in.
 */
loadDotenv({ path: path.join(REPO_ROOT, ".env") });

async function main(): Promise<boolean> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);
  const config = buildRuntimeConfig(env);
  const messages = createMessages(config.messagesFile, logger);
  // The command list only needs a draft store to be constructed, not used.
  const commands = createCommands(new EmbedDraftStore(config.embedDraftTtlMs), messages);
  return syncCommands(env, commands, logger, {
    mode: "always",
    hashFile: config.commandsHashFile,
  });
}

main()
  .then((ok) => process.exit(ok ? 0 : 1))
  .catch((error) => {
    console.error("fatal: command registration failed", error);
    process.exit(1);
  });
