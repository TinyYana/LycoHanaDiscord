import {
  type ButtonInteraction,
  type ChannelSelectMenuInteraction,
  MessageFlags,
  type ModalSubmitInteraction,
} from "discord.js";

type DraftRepliableInteraction =
  | ButtonInteraction
  | ChannelSelectMenuInteraction
  | ModalSubmitInteraction;

export async function replyEphemeral(
  interaction: DraftRepliableInteraction,
  content: string,
): Promise<void> {
  await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}
