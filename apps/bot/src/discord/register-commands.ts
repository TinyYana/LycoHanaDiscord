import { REST, Routes } from "discord.js";
import type { Command } from "../commands/types";
import type { Env } from "../config/env";
import type { Logger } from "../logger";

/**
 * Push slash-command definitions to Discord. Registers to a single guild when
 * DISCORD_GUILD_ID is set (instant — for dev/testing), otherwise globally.
 */
export async function registerCommands(
  env: Env,
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
