import {
  ChannelType,
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { HoneypotAction } from "@lycohana/domain";
import type { Command, CommandContext } from "./types";
import { buildHoneypotNotice } from "../honeypot";

/** A chat-input interaction already known to be in a guild (guildId: string). */
type GuildChatInput = ChatInputCommandInteraction<"cached" | "raw">;

export const honeypot: Command = {
  data: new SlashCommandBuilder()
    .setName("honeypot")
    .setDescription("（管理員）誘捕頻道：非管理員在此發言將被自動處置")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("設定一個誘捕頻道")
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("誘捕頻道")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("action")
            .setDescription("處置方式（預設禁言）")
            .addChoices(
              { name: "禁言 timeout", value: "timeout" },
              { name: "封鎖 ban", value: "ban" },
            ),
        )
        .addIntegerOption((o) =>
          o
            .setName("timeout_minutes")
            .setDescription("禁言時長（分鐘，僅 timeout 適用；省略則用預設）")
            .setMinValue(1)
            .setMaxValue(40320),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("移除一個誘捕頻道")
        .addChannelOption((o) => o.setName("channel").setDescription("誘捕頻道").setRequired(true)),
    )
    .addSubcommand((s) => s.setName("list").setDescription("列出目前的誘捕頻道")),

  async execute(interaction, ctx) {
    if (!interaction.inGuild()) {
      await reply(interaction, "請在伺服器內使用。");
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await reply(interaction, "此指令僅限管理員。");
      return;
    }

    const sub = interaction.options.getSubcommand();
    if (sub === "add") return add(interaction, ctx);
    if (sub === "remove") return remove(interaction, ctx);
    if (sub === "list") return list(interaction, ctx);
  },
};

async function add(interaction: GuildChatInput, ctx: CommandContext): Promise<void> {
  const channel = interaction.options.getChannel("channel", true);
  const action = (interaction.options.getString("action") as HoneypotAction | null) ?? "timeout";
  const minutes = interaction.options.getInteger("timeout_minutes");
  const timeoutSeconds = action === "timeout" && minutes ? minutes * 60 : null;

  await ctx.repos.honeypot.upsert({
    guildId: interaction.guildId,
    channelId: channel.id,
    action,
    timeoutSeconds,
  });

  const posted = await postNotice(interaction, channel.id, action);
  const detail =
    action === "ban" ? "封鎖" : `禁言（${timeoutSeconds ? `${minutes} 分鐘` : "預設時長"}）`;
  const noticeLine = posted
    ? "\n已在該頻道張貼警告訊息提醒一般成員。"
    : "\n⚠️ 我無法在該頻道發送訊息（缺少檢視／發送／嵌入連結權限），請手動提醒或調整權限。";
  await reply(
    interaction,
    `已將 <#${channel.id}> 設為誘捕頻道，處置方式：${detail}。${noticeLine}`,
  );
}

/** Post the public warning embed into the channel; returns false if blocked. */
async function postNotice(
  interaction: GuildChatInput,
  channelId: string,
  action: HoneypotAction,
): Promise<boolean> {
  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || channel.isDMBased()) return false;
  const me = channel.guild.members.me;
  const canSend = me
    ?.permissionsIn(channel)
    .has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ]);
  if (!canSend) return false;
  try {
    await channel.send({ embeds: [buildHoneypotNotice(action)] });
    return true;
  } catch {
    return false;
  }
}

async function remove(interaction: GuildChatInput, ctx: CommandContext): Promise<void> {
  const channel = interaction.options.getChannel("channel", true);
  const removed = await ctx.repos.honeypot.remove(interaction.guildId, channel.id);
  await reply(
    interaction,
    removed ? `已移除誘捕頻道 <#${channel.id}>。` : `<#${channel.id}> 原本就不是誘捕頻道。`,
  );
}

async function list(interaction: GuildChatInput, ctx: CommandContext): Promise<void> {
  const rows = await ctx.repos.honeypot.list(interaction.guildId);
  if (rows.length === 0) {
    await reply(interaction, "目前沒有設定誘捕頻道。");
    return;
  }
  const lines = rows.map((row) => {
    const detail =
      row.action === "ban"
        ? "封鎖"
        : `禁言（${row.timeoutSeconds ? `${row.timeoutSeconds / 60} 分鐘` : "預設"}）`;
    return `• <#${row.channelId}> — ${detail}`;
  });
  await reply(interaction, `誘捕頻道：\n${lines.join("\n")}`);
}

function reply(interaction: ChatInputCommandInteraction, content: string): Promise<unknown> {
  return interaction.reply({ content, flags: MessageFlags.Ephemeral });
}
