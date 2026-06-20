import {
  type ButtonInteraction,
  type ChannelSelectMenuInteraction,
  type Interaction,
  MessageFlags,
  type ModalSubmitInteraction,
  PermissionFlagsBits,
} from "discord.js";
import type { CommandContext } from "../commands/types";
import { handleDraftButton } from "./button-interaction";
import { handleDraftChannelSelect } from "./channel-interaction";
import { handleDraftModalSubmit } from "./modal-interaction";
import type { EmbedDraft, EmbedDraftStore } from "./store";
import { parseDraftCustomId } from "./view";

export function createEmbedDraftInteractionHandler(store: EmbedDraftStore) {
  return async function handleEmbedDraftInteraction(
    interaction: Interaction,
    ctx: CommandContext,
  ): Promise<boolean> {
    if (!isDraftComponent(interaction)) return false;

    const parsed = parseDraftCustomId(interaction.customId);
    if (!parsed) return false;

    const draft = await resolveUsableDraft(interaction, store.get(parsed.draftId));
    if (!draft) return true;

    if (interaction.isButton()) {
      await handleDraftButton(interaction, ctx, store, draft, parsed.action);
    } else if (interaction.isChannelSelectMenu()) {
      await handleDraftChannelSelect(interaction, draft, parsed.action);
    } else {
      await handleDraftModalSubmit(interaction, ctx, draft, parsed.action);
    }
    return true;
  };
}

type DraftComponentInteraction =
  | ButtonInteraction
  | ChannelSelectMenuInteraction
  | ModalSubmitInteraction;

function isDraftComponent(interaction: Interaction): interaction is DraftComponentInteraction {
  return interaction.isButton() || interaction.isChannelSelectMenu() || interaction.isModalSubmit();
}

async function resolveUsableDraft(
  interaction: DraftComponentInteraction,
  draft: EmbedDraft | undefined,
): Promise<EmbedDraft | undefined> {
  if (!draft) {
    await interaction.reply({
      content: "這份草稿已過期或不存在。",
      flags: MessageFlags.Ephemeral,
    });
    return undefined;
  }
  if (!isDraftOwner(interaction, draft)) {
    await interaction.reply({ content: "這不是你的草稿。", flags: MessageFlags.Ephemeral });
    return undefined;
  }
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: "此功能僅限管理員。", flags: MessageFlags.Ephemeral });
    return undefined;
  }
  const stateMessage = unavailableStateMessage(draft);
  if (stateMessage) {
    await interaction.reply({ content: stateMessage, flags: MessageFlags.Ephemeral });
    return undefined;
  }
  return draft;
}

function isDraftOwner(interaction: DraftComponentInteraction, draft: EmbedDraft): boolean {
  return (
    interaction.inGuild() &&
    interaction.guildId === draft.guildId &&
    interaction.user.id === draft.ownerId
  );
}

function unavailableStateMessage(draft: EmbedDraft): string | undefined {
  if (draft.status === "sent") return "這份草稿已經送出。";
  if (draft.status === "sending") return "這份草稿正在送出。";
  return undefined;
}
