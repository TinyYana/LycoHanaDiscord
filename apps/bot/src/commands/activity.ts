import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import {
  computeActivityScore,
  dateKey,
  monthRange,
  rollingWindowStart,
  type ActivityCounts,
} from "@lycohana/domain";
import type { ActivityDaily } from "@lycohana/db";
import type { Command, CommandContext } from "./types";

export const activity: Command = {
  data: new SlashCommandBuilder()
    .setName("activity")
    .setDescription("活躍度痕跡")
    .addSubcommand((s) => s.setName("me").setDescription("查看你本月的活躍痕跡"))
    .addSubcommand((s) => s.setName("stats").setDescription("（管理員）活躍度概況與門檻分佈")),

  async execute(interaction, ctx) {
    const sub = interaction.options.getSubcommand();
    if (sub === "me") return showMe(interaction, ctx);
    if (sub === "stats") return showStats(interaction, ctx);
  },
};

async function showMe(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "請在伺服器內使用。", flags: MessageFlags.Ephemeral });
    return;
  }

  const { start, end } = monthRange(new Date(), ctx.config.timeZone);
  const rows = await ctx.repos.activity.listForUserBetween(
    interaction.guildId,
    interaction.user.id,
    start,
    end,
  );
  const totals = sumCounts(rows);

  const embed = new EmbedBuilder()
    .setTitle("🌸 你的本月活躍痕跡")
    .setDescription(`期間：${start} ~ ${end}`)
    .addFields(
      { name: "💬 聊天", value: String(totals.chatCount), inline: true },
      { name: "🎙️ 語音", value: formatDuration(totals.voiceSeconds), inline: true },
      { name: "🖼️ 圖片", value: String(totals.imageCount), inline: true },
      { name: "🎵 音樂分享", value: String(totals.musicCount), inline: true },
      { name: "🤝 互動", value: String(totals.interactionCount), inline: true },
    )
    .setFooter({ text: "只有你看得到 · 這不是公開排名" });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function showStats(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "請在伺服器內使用。", flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: "此指令僅限管理員。", flags: MessageFlags.Ephemeral });
    return;
  }

  const now = new Date();
  const windowDays = ctx.config.activeMemberWindowDays;
  const from = rollingWindowStart(now, windowDays, ctx.config.timeZone);
  const to = dateKey(now, ctx.config.timeZone);

  const config = await ctx.repos.guildConfig.ensure(interaction.guildId);
  const totals = await ctx.repos.activity.aggregateByUserBetween(interaction.guildId, from, to);
  const scores = totals
    .map((t) => computeActivityScore(t.counts, config.activityWeights))
    .sort((a, b) => a - b);

  const embed = new EmbedBuilder()
    .setTitle(`📊 活躍度概況（滾動 ${windowDays} 天）`)
    .setDescription(`期間：${from} ~ ${to}\n有活動成員：**${scores.length}** 人`)
    .setFooter({ text: "僅供觀察門檻分佈 · 不是公開排行榜" });

  if (scores.length > 0) {
    const median = scores[Math.floor(scores.length / 2)];
    embed.addFields({
      name: "分數",
      value: `min ${fmt(scores[0])} · median ${fmt(median)} · max ${fmt(scores[scores.length - 1])}`,
    });

    const { activityThresholdHigh: high, activityThresholdLow: low } = config;
    if (high != null || low != null) {
      const parts: string[] = [];
      if (high != null) parts.push(`≥ 高標(${high})：${scores.filter((s) => s >= high).length} 人`);
      if (low != null) parts.push(`< 低標(${low})：${scores.filter((s) => s < low).length} 人`);
      embed.addFields({ name: "門檻", value: parts.join("\n") });
    } else {
      embed.addFields({ name: "門檻", value: "尚未設定高標/低標（見 M4）" });
    }
  }

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

function sumCounts(rows: ActivityDaily[]): ActivityCounts {
  return rows.reduce<ActivityCounts>(
    (acc, r) => ({
      chatCount: acc.chatCount + r.chatCount,
      voiceSeconds: acc.voiceSeconds + r.voiceSeconds,
      imageCount: acc.imageCount + r.imageCount,
      musicCount: acc.musicCount + r.musicCount,
      interactionCount: acc.interactionCount + r.interactionCount,
    }),
    { chatCount: 0, voiceSeconds: 0, imageCount: 0, musicCount: 0, interactionCount: 0 },
  );
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} 小時 ${minutes} 分`;
  return `${minutes} 分`;
}

function fmt(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}
