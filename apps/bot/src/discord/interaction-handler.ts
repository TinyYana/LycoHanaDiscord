import {
  Collection,
  type Interaction,
  type InteractionReplyOptions,
  MessageFlags,
} from "discord.js";
import type { Command, CommandContext } from "../commands/types";

/**
 * Build the `interactionCreate` listener: routes chat-input commands to their
 * handler and contains errors so one failing command never crashes the bot.
 */
export function createInteractionHandler(commands: Command[], ctx: CommandContext) {
  const byName = new Collection<string, Command>();
  for (const command of commands) byName.set(command.data.name, command);

  return async function handleInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const command = byName.get(interaction.commandName);
    if (!command) {
      ctx.logger.warn("unknown command", { command: interaction.commandName });
      return;
    }

    try {
      await command.execute(interaction, ctx);
    } catch (error) {
      ctx.logger.error("command failed", {
        command: interaction.commandName,
        error: error instanceof Error ? error.message : String(error),
      });
      const reply: InteractionReplyOptions = {
        content: "發生錯誤，請稍後再試。",
        flags: MessageFlags.Ephemeral,
      };
      const respond =
        interaction.replied || interaction.deferred
          ? interaction.followUp(reply)
          : interaction.reply(reply);
      await respond.catch(() => undefined);
    }
  };
}
