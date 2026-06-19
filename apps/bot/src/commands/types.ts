import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import type { Logger } from "../logger";

/**
 * Shared dependencies passed to every command. Grows as milestones need it
 * (repositories arrive with M3); kept to `logger` for M2.
 */
export interface CommandContext {
  logger: Logger;
}

/** Any of the slash-command builder shapes a command might use. */
export type CommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

export interface Command {
  data: CommandData;
  execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void>;
}
