import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
} from "discord.js";
import type { EmbedTemplatePayload } from "@lycohana/domain";
import type { EmbedDraft } from "./store";

export function draftCustomId(draftId: string, action: string): string {
  return `embed-draft:${draftId}:${action}`;
}

export function parseDraftCustomId(
  customId: string,
): { draftId: string; action: string } | undefined {
  const [prefix, draftId, action, extra] = customId.split(":");
  if (prefix !== "embed-draft" || !draftId || !action || extra != null) return undefined;
  return { draftId, action };
}

export function buildEmbed(payload: EmbedTemplatePayload): EmbedBuilder {
  const embed = new EmbedBuilder();
  applyEmbedText(embed, payload);
  applyEmbedAppearance(embed, payload);
  if (payload.fields?.length) embed.addFields(payload.fields);
  return embed;
}

function applyEmbedText(embed: EmbedBuilder, payload: EmbedTemplatePayload): void {
  if (payload.title) embed.setTitle(payload.title);
  if (payload.description) embed.setDescription(payload.description);
  if (payload.footer) embed.setFooter({ text: payload.footer });
}

function applyEmbedAppearance(embed: EmbedBuilder, payload: EmbedTemplatePayload): void {
  if (payload.color != null) embed.setColor(payload.color);
  if (payload.imageUrl) embed.setImage(payload.imageUrl);
  if (payload.thumbnailUrl) embed.setThumbnail(payload.thumbnailUrl);
}

export function draftPanel(draft: EmbedDraft, confirming = false) {
  if (confirming) {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(draftCustomId(draft.id, "confirm"))
          .setLabel("確認送出")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(draftCustomId(draft.id, "back"))
          .setLabel("返回編輯")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(draftCustomId(draft.id, "cancel"))
          .setLabel("取消草稿")
          .setStyle(ButtonStyle.Secondary),
      ),
    ];
  }

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(draftCustomId(draft.id, "text"))
        .setLabel("編輯文字")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(draftCustomId(draft.id, "appearance"))
        .setLabel("編輯外觀")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(draftCustomId(draft.id, "preview"))
        .setLabel("預覽")
        .setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(draftCustomId(draft.id, "channel"))
        .setPlaceholder(draft.targetChannelId ? "重新選擇目標頻道" : "設定目標頻道")
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(draftCustomId(draft.id, "save"))
        .setLabel("儲存模板")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(draftCustomId(draft.id, "send"))
        .setLabel("送出")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(draftCustomId(draft.id, "cancel"))
        .setLabel("取消")
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

export function panelContent(draft: EmbedDraft, confirming = false): string {
  const target = draft.targetChannelId ? `<#${draft.targetChannelId}>` : "尚未設定";
  const state = confirming ? "請確認是否送出；仍可返回編輯。" : "草稿只會保存在記憶體中。";
  return `**Embed 草稿控制面板**\n目標頻道：${target}\n${state}`;
}

export function hasEmbedContent(payload: EmbedTemplatePayload): boolean {
  return Boolean(payload.title?.trim() || payload.description?.trim());
}
