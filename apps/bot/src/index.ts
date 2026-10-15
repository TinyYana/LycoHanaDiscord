import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { Events } from "discord.js";
import { createDb, createRepositories } from "@lycohana/db";
import { loadEnv } from "./config/env";
import { buildRuntimeConfig } from "./config/runtime";
import { createLogger } from "./logger";
import { createClient } from "./discord/client";
import { syncCommands } from "./discord/register-commands";
import { createInteractionHandler } from "./discord/interaction-handler";
import { registerActivityTracking } from "./activity";
import { scheduleActiveMemberSweep } from "./active-member";
import { createCommands } from "./commands";
import { handleRoleMenuInteraction } from "./role-menu";
import { createEmbedDraftInteractionHandler, EmbedDraftStore } from "./embed-draft";
import { registerMemberEvents } from "./members";
import { createModerationLog } from "./moderation";
import { registerHoneypot } from "./honeypot";
import { registerDynamicVoice } from "./dynamic-voice";
import { createRuntimeStatus } from "./runtime-status";
import { exposePm2Metrics } from "./runtime-status/pm2-metrics";
import { bindShutdownTriggers, createShutdown } from "./shutdown";
import { createMessages } from "./messages";
import { startAdminServer } from "./admin";
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

  // SHUTDOWN_TIMEOUT_MS must stay below PM2's kill_timeout (ecosystem.config.cjs).
  const shutdown = createShutdown({ logger, timeoutMs: config.shutdownTimeoutMs });
  bindShutdownTriggers(shutdown);
  const messages = createMessages(config.messagesFile, logger);

  const db = createDb(env.DATABASE_URL);
  const repos = createRepositories(db);

  const client = createClient();
  const runtimeStatus = createRuntimeStatus(client);
  exposePm2Metrics(runtimeStatus, messages);
  const ctx: CommandContext = { logger, repos, config, messages };
  const embedDrafts = new EmbedDraftStore(config.embedDraftTtlMs);
  const commands = createCommands(embedDrafts, messages);

  registerActivityTracking(client, {
    repos,
    logger,
    limits: config.limits,
    timeZone: config.timeZone,
  });
  registerMemberEvents(client, { repos, logger });
  registerDynamicVoice(client, {
    repos,
    logger,
    emptyGraceMs: config.dynamicVoiceEmptyGraceMs,
  });

  const moderationLog = createModerationLog({ repos, logger });
  registerHoneypot(client, {
    repos,
    logger,
    moderationLog,
    defaultTimeoutSeconds: config.honeypotTimeoutSeconds,
  });

  const sweepTask = scheduleActiveMemberSweep(
    client,
    {
      repos,
      logger,
      messages,
      windowDays: config.activeMemberWindowDays,
      timeZone: config.timeZone,
      recordResult: (result) => runtimeStatus.recordSweep(result),
    },
    config.activeMemberCron,
  );
  if (sweepTask) shutdown.add({ name: "active-member cron", run: () => sweepTask.stop() });

  client.once(Events.ClientReady, (ready) => {
    logger.info("bot ready", { user: ready.user.tag, guilds: ready.guilds.cache.size });
  });
  client.on(
    Events.InteractionCreate,
    createInteractionHandler(
      commands,
      [handleRoleMenuInteraction, createEmbedDraftInteractionHandler(embedDrafts)],
      ctx,
    ),
  );
  client.on(Events.Error, (error) => logger.error("client error", { error: error.message }));

  // Local-only admin panel (127.0.0.1). A listen failure is logged and the bot
  // runs on without it.
  const adminServer = await startAdminServer({
    logger,
    repos,
    config,
    client,
    runtimeStatus,
    messages,
  });
  if (adminServer) shutdown.add({ name: "admin panel", run: () => adminServer.close() });

  // Steps run in the order added: anything added above (cron, admin HTTP
  // server, …) is released before the Discord client and the DB pool.
  shutdown.add({ name: "discord client", run: () => client.destroy() });
  shutdown.add({ name: "database", run: () => db.$client.end() });

  // Re-registers only when the command definitions changed (mode `auto`); a
  // failure is logged and the bot still logs in with the existing commands.
  await syncCommands(env, commands, logger, {
    mode: env.COMMANDS_REGISTER_MODE,
    hashFile: config.commandsHashFile,
  });
  await client.login(env.DISCORD_TOKEN);
}

main().catch((error) => {
  // Logger may not exist yet (e.g. env validation failed), so use console here.
  console.error("fatal: bot failed to start", error);
  process.exit(1);
});
