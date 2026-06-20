import {
  type ModalMessageModalSubmitInteraction,
  type ModalSubmitInteraction,
  MessageFlags,
} from "discord.js";
import type { CommandContext } from "../commands/types";
import type { EmbedDraft } from "./store";
import { applyTextValues, readAppearanceValues } from "./modal-values";
import { draftPanel, panelContent } from "./view";

export async function handleDraftModalSubmit(
  interaction: ModalSubmitInteraction,
  ctx: CommandContext,
  draft: EmbedDraft,
  action: string,
): Promise<void> {
  if (!interaction.isFromMessage()) {
    await interaction.reply({
      content: "找不到原本的草稿控制面板，請重新建立草稿。",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (action === "text-modal") {
    applyTextValues(draft, interaction);
    await updatePanel(interaction, draft, "已更新草稿文字。");
    return;
  }

  if (action === "appearance-modal") {
    const values = readAppearanceValues(interaction);
    if (!values) {
      await interaction.reply({
        content: "色碼需為 6 位 hex；圖片網址需使用 http 或 https。",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    Object.assign(draft.payload, values);
    await updatePanel(interaction, draft, "已更新草稿外觀。");
    return;
  }

  if (action === "save-modal") {
    const name = interaction.fields.getTextInputValue("name").trim();
    await ctx.repos.embedTemplate.save({
      guildId: draft.guildId,
      name,
      payload: draft.payload,
      createdBy: draft.ownerId,
    });
    ctx.logger.info("embed template saved", {
      guild: draft.guildId,
      user: draft.ownerId,
      name,
    });
    await updatePanel(interaction, draft, `已儲存模板 **${name}**；同名模板會更新。`);
    return;
  }

  await interaction.reply({
    content: "無法辨識這個草稿表單。",
    flags: MessageFlags.Ephemeral,
  });
}

async function updatePanel(
  interaction: ModalMessageModalSubmitInteraction,
  draft: EmbedDraft,
  notice: string,
): Promise<void> {
  await interaction.update({
    content: `${panelContent(draft)}\n${notice}`,
    components: draftPanel(draft),
  });
}
