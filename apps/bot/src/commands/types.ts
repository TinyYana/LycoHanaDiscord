import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import type { Repositories } from "@lycohana/db";
import type { Logger } from "../logger";
import type { RuntimeConfig } from "../config/runtime";

/** Shared dependencies passed to every command. */
export interface CommandContext {
  logger: Logger;
  repos: Repositories;
  config: RuntimeConfig;
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
