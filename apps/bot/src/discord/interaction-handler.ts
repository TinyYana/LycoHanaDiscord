import {
  type ChatInputCommandInteraction,
  Collection,
  type Interaction,
  type InteractionReplyOptions,
  MessageFlags,
} from "discord.js";
import type { Command, CommandContext } from "../commands/types";

export type ComponentHandler = (interaction: Interaction, ctx: CommandContext) => Promise<boolean>;

/**
 * Build the `interactionCreate` listener: routes chat-input commands to their
 * handler and contains errors so one failing command never crashes the bot.
 */
export function createInteractionHandler(
  commands: Command[],
  componentHandlers: ComponentHandler[],
  ctx: CommandContext,
) {
  const byName = new Collection<string, Command>();
  for (const command of commands) byName.set(command.data.name, command);

  return async function handleInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand())
      return handleComponents(interaction, componentHandlers, ctx);
    await handleCommand(interaction, byName, ctx);
  };
}

async function handleComponents(
  interaction: Interaction,
  handlers: ComponentHandler[],
  ctx: CommandContext,
): Promise<void> {
  try {
    for (const handler of handlers) {
      if (await handler(interaction, ctx)) return;
    }
  } catch (error) {
    ctx.logger.error("component interaction failed", {
      type: interaction.type,
      error: error instanceof Error ? error.message : String(error),
    });
    await respondWithError(interaction);
  }
}

async function handleCommand(
  interaction: ChatInputCommandInteraction,
  commands: Collection<string, Command>,
  ctx: CommandContext,
): Promise<void> {
  const command = commands.get(interaction.commandName);
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
    await respondWithError(interaction);
  }
}

async function respondWithError(interaction: Interaction): Promise<void> {
  if (!interaction.isRepliable()) return;
  const reply: InteractionReplyOptions = {
    content: "發生錯誤，請稍後再試。",
    flags: MessageFlags.Ephemeral,
  };
  const response =
    interaction.replied || interaction.deferred
      ? interaction.followUp(reply)
      : interaction.reply(reply);
  await response.catch(() => undefined);
}
