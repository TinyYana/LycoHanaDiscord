import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { REST, Routes } from "discord.js";
import type { Command } from "../commands/types";
import type { Env } from "../config/env";
import type { Logger } from "../logger";
import { errMessage } from "../errors";

type RegisterEnv = Pick<Env, "DISCORD_TOKEN" | "DISCORD_CLIENT_ID" | "DISCORD_GUILD_ID">;

/**
 * Push slash-command definitions to Discord. Registers to a single guild when
 * DISCORD_GUILD_ID is set (instant — for dev/testing), otherwise globally.
 */
export async function registerCommands(
  env: RegisterEnv,
  commands: Command[],
  logger: Logger,
): Promise<void> {
  const rest = new REST().setToken(env.DISCORD_TOKEN);
  const body = commands.map((command) => command.data.toJSON());

  if (env.DISCORD_GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), {
      body,
    });
    logger.info("registered guild commands", { count: body.length, guildId: env.DISCORD_GUILD_ID });
  } else {
    await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body });
    logger.info("registered global commands", { count: body.length });
  }
}

/** Fingerprint of what would be registered and where. */
function commandsHash(env: RegisterEnv, commands: Command[]): string {
  const payload = {
    app: env.DISCORD_CLIENT_ID,
    guild: env.DISCORD_GUILD_ID ?? null,
    body: commands.map((command) => command.data.toJSON()),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function readHash(file: string): string | undefined {
  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    return undefined;
  }
}

export interface SyncCommandsOptions {
  /** `auto`: only when the hash changed; `always`: every time; `off`: never. */
  mode: Env["COMMANDS_REGISTER_MODE"];
  hashFile: string;
}

/**
 * Register slash commands when needed and remember what was pushed. Never
 * throws: a failure is logged and reported as `false`, so the bot can still
 * log in with the previously registered commands.
 */
export async function syncCommands(
  env: RegisterEnv,
  commands: Command[],
  logger: Logger,
  options: SyncCommandsOptions,
): Promise<boolean> {
  if (options.mode === "off") {
    logger.info("slash command registration disabled", { mode: options.mode });
    return true;
  }
  const hash = commandsHash(env, commands);
  if (options.mode === "auto" && readHash(options.hashFile) === hash) {
    logger.info("slash commands unchanged; registration skipped", { hashFile: options.hashFile });
    return true;
  }
  try {
    await registerCommands(env, commands, logger);
    mkdirSync(path.dirname(options.hashFile), { recursive: true });
    writeFileSync(options.hashFile, `${hash}\n`);
    return true;
  } catch (error) {
    logger.error("slash command registration failed", { error: errMessage(error) });
    return false;
  }
}
