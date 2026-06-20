import { type ButtonInteraction, MessageFlags } from "discord.js";
import type { CommandContext } from "../commands/types";
import { appearanceModal, saveTemplateModal, textModal } from "./modals";
import type { EmbedDraft, EmbedDraftStore } from "./store";
import { resolveWritableEmbedChannel } from "./channel";
import { replyEphemeral } from "./responses";
import { buildEmbed, draftPanel, hasEmbedContent, panelContent } from "./view";

export async function handleDraftButton(
  interaction: ButtonInteraction,
  ctx: CommandContext,
  store: EmbedDraftStore,
  draft: EmbedDraft,
  action: string,
): Promise<void> {
  const actions: Record<string, () => Promise<void>> = {
    text: () => interaction.showModal(textModal(draft)),
    appearance: () => interaction.showModal(appearanceModal(draft)),
    save: () => openSaveModal(interaction, draft),
    preview: () => previewDraft(interaction, draft),
    send: () => requestConfirmation(interaction, draft),
    back: () => restorePanel(interaction, draft),
    confirm: () => sendDraft(interaction, ctx, draft),
    cancel: () => cancelDraft(interaction, store, draft),
  };
  const handler = actions[action];
  if (handler) await handler();
  else await replyEphemeral(interaction, "無法辨識這個草稿操作。");
}

async function restorePanel(interaction: ButtonInteraction, draft: EmbedDraft): Promise<void> {
  await interaction.update({ content: panelContent(draft), components: draftPanel(draft) });
}

async function cancelDraft(
  interaction: ButtonInteraction,
  store: EmbedDraftStore,
  draft: EmbedDraft,
): Promise<void> {
  store.delete(draft.id);
  await interaction.update({ content: "已取消這份 Embed 草稿。", components: [] });
}

async function openSaveModal(interaction: ButtonInteraction, draft: EmbedDraft): Promise<void> {
  if (!hasEmbedContent(draft.payload)) {
    await replyEphemeral(interaction, "儲存模板前，請先填寫標題或描述。");
    return;
  }
  await interaction.showModal(saveTemplateModal(draft));
}

async function previewDraft(interaction: ButtonInteraction, draft: EmbedDraft): Promise<void> {
  if (!hasEmbedContent(draft.payload)) {
    await replyEphemeral(interaction, "預覽前，請先填寫標題或描述。");
    return;
  }
  await interaction.reply({ embeds: [buildEmbed(draft.payload)], flags: MessageFlags.Ephemeral });
}

async function requestConfirmation(
  interaction: ButtonInteraction,
  draft: EmbedDraft,
): Promise<void> {
  if (!draft.targetChannelId) {
    await replyEphemeral(interaction, "送出前，請先選擇目標頻道。");
    return;
  }
  if (!hasEmbedContent(draft.payload)) {
    await replyEphemeral(interaction, "送出前，請先填寫標題或描述。");
    return;
  }
  await interaction.update({
    content: panelContent(draft, true),
    components: draftPanel(draft, true),
  });
}

async function sendDraft(
  interaction: ButtonInteraction,
  ctx: CommandContext,
  draft: EmbedDraft,
): Promise<void> {
  if (!interaction.inCachedGuild() || !draft.targetChannelId) {
    await replyEphemeral(interaction, "找不到伺服器或目標頻道，請返回編輯。");
    return;
  }

  draft.status = "sending";
  const result = await resolveWritableEmbedChannel(interaction.guild, draft.targetChannelId);
  if (!result.ok) {
    draft.status = "editing";
    await replyEphemeral(interaction, result.message);
    return;
  }

  try {
    await result.channel.send({ embeds: [buildEmbed(draft.payload)] });
    draft.status = "sent";
  } catch (error) {
    draft.status = "editing";
    throw error;
  }

  ctx.logger.info("embed draft sent", {
    guild: draft.guildId,
    user: draft.ownerId,
    channel: result.channel.id,
    draft: draft.id,
  });
  await interaction.update({
    content: `已送出到 <#${result.channel.id}>。這份草稿已鎖定。`,
    components: [],
  });
}
