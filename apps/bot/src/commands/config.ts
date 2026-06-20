import {
  ChannelType,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { ActivityWeights } from "@lycohana/domain";
import type { GuildConfig } from "@lycohana/db";
import { sensitiveRoleWarning } from "../discord/role-policy";
import type { Command, CommandContext } from "./types";

/** A chat-input interaction already known to be in a guild (guildId: string). */
type GuildChatInput = ChatInputCommandInteraction<"cached" | "raw">;

export const config: Command = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("（管理員）伺服器設定")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) => s.setName("view").setDescription("查看目前伺服器設定"))
    .addSubcommand((s) =>
      s
        .setName("active-role")
        .setDescription("設定活躍成員身分組")
        .addRoleOption((o) => o.setName("role").setDescription("身分組").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("thresholds")
        .setDescription("設定發放/回收門檻")
        .addIntegerOption((o) =>
          o
            .setName("high")
            .setDescription("高標：分數 ≥ 此值發放")
            .setRequired(true)
            .setMinValue(0),
        )
        .addIntegerOption((o) =>
          o.setName("low").setDescription("低標：分數 < 此值回收").setRequired(true).setMinValue(0),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("weights")
        .setDescription("設定活躍度權重")
        .addIntegerOption((o) =>
          o.setName("chat").setDescription("聊天").setRequired(true).setMinValue(0),
        )
        .addIntegerOption((o) =>
          o.setName("image").setDescription("圖片").setRequired(true).setMinValue(0),
        )
        .addIntegerOption((o) =>
          o.setName("music").setDescription("音樂").setRequired(true).setMinValue(0),
        )
        .addIntegerOption((o) =>
          o.setName("interaction").setDescription("互動").setRequired(true).setMinValue(0),
        )
        .addIntegerOption((o) =>
          o
            .setName("voice_per_10min")
            .setDescription("語音每 10 分鐘")
            .setRequired(true)
            .setMinValue(0),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("exempt-add")
        .setDescription("新增豁免身分組（不受活躍成員自動發放/回收影響）")
        .addRoleOption((o) => o.setName("role").setDescription("身分組").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("exempt-remove")
        .setDescription("移除豁免身分組")
        .addRoleOption((o) => o.setName("role").setDescription("身分組").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("welcome")
        .setDescription("設定歡迎訊息")
        .addBooleanOption((o) => o.setName("enabled").setDescription("是否啟用").setRequired(true))
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("歡迎頻道（啟用時若尚未設定則必填）")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("leave-log")
        .setDescription("設定離開紀錄頻道")
        .addBooleanOption((o) => o.setName("enabled").setDescription("是否啟用").setRequired(true))
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("離開紀錄頻道（啟用時必填）")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("log-channel")
        .setDescription("設定管理紀錄頻道（honeypot 等系統動作會貼到這裡）")
        .addBooleanOption((o) => o.setName("enabled").setDescription("是否啟用").setRequired(true))
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("管理紀錄頻道（啟用時必填）")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("dynamic-voice")
        .setDescription("設定動態語音頻道入口")
        .addBooleanOption((o) => o.setName("enabled").setDescription("是否啟用").setRequired(true))
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("成員加入後會建立專屬頻道的語音入口")
            .addChannelTypes(ChannelType.GuildVoice),
        ),
    ),

  async execute(interaction, ctx) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "請在伺服器內使用。", flags: MessageFlags.Ephemeral });
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "此指令僅限管理員。", flags: MessageFlags.Ephemeral });
      return;
    }

    const handler = CONFIG_HANDLERS[interaction.options.getSubcommand()];
    if (handler) await handler(interaction, ctx);
  },
};

function reply(interaction: ChatInputCommandInteraction, content: string): Promise<unknown> {
  return interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

function welcomeSummary(cfg: GuildConfig): string {
  if (!cfg.welcomeEnabled) return "停用";
  return cfg.welcomeChannelId ? `啟用 · <#${cfg.welcomeChannelId}>` : "啟用但尚未設定頻道";
}

function channelSummary(channelId: string | null): string {
  return channelId ? `<#${channelId}>` : "停用";
}

async function view(interaction: GuildChatInput, ctx: CommandContext): Promise<void> {
  const cfg = await ctx.repos.guildConfig.ensure(interaction.guildId);
  const w = cfg.activityWeights;
  const embed = new EmbedBuilder().setTitle("⚙️ 活躍成員設定").addFields(
    {
      name: "身分組",
      value: cfg.activeMemberRoleId ? `<@&${cfg.activeMemberRoleId}>` : "（未設定）",
    },
    {
      name: "門檻",
      value: `高標 ${cfg.activityThresholdHigh ?? "（未設定）"} · 低標 ${cfg.activityThresholdLow ?? "（未設定）"}`,
    },
    {
      name: "權重",
      value: `聊天 ${w.chat} · 圖片 ${w.image} · 音樂 ${w.music} · 互動 ${w.interaction} · 語音/10分 ${w.voicePer10Min}`,
    },
    {
      name: "豁免身分組",
      value: cfg.exemptRoleIds.length
        ? cfg.exemptRoleIds.map((id) => `<@&${id}>`).join(" ")
        : "（無）",
    },
    { name: "歡迎訊息", value: welcomeSummary(cfg) },
    { name: "離開紀錄", value: channelSummary(cfg.leaveLogChannelId) },
    { name: "管理紀錄", value: channelSummary(cfg.logChannelId) },
    { name: "動態語音入口", value: channelSummary(cfg.dynamicVoiceTriggerChannelId) },
  );
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function setWelcome(interaction: GuildChatInput, ctx: CommandContext): Promise<void> {
  const enabled = interaction.options.getBoolean("enabled", true);
  const channel = interaction.options.getChannel("channel");
  const current = await ctx.repos.guildConfig.ensure(interaction.guildId);
  const channelId = channel?.id ?? current.welcomeChannelId;
  if (enabled && !channelId) {
    await reply(interaction, "啟用歡迎訊息時，請先選擇歡迎頻道。");
    return;
  }
  await ctx.repos.guildConfig.update(interaction.guildId, {
    welcomeEnabled: enabled,
    ...(channel ? { welcomeChannelId: channel.id } : {}),
  });
  await reply(
    interaction,
    enabled ? `已啟用歡迎訊息，頻道為 <#${channelId}>。` : "已停用歡迎訊息。",
  );
}

async function setLeaveLog(interaction: GuildChatInput, ctx: CommandContext): Promise<void> {
  const enabled = interaction.options.getBoolean("enabled", true);
  const channel = interaction.options.getChannel("channel");
  if (enabled && !channel) {
    await reply(interaction, "啟用離開紀錄時，請選擇紀錄頻道。");
    return;
  }
  await ctx.repos.guildConfig.update(interaction.guildId, {
    leaveLogChannelId: enabled ? channel?.id : null,
  });
  await reply(
    interaction,
    enabled ? `已設定離開紀錄頻道為 <#${channel?.id}>。` : "已停用離開紀錄。",
  );
}

async function setLogChannel(interaction: GuildChatInput, ctx: CommandContext): Promise<void> {
  const enabled = interaction.options.getBoolean("enabled", true);
  const channel = interaction.options.getChannel("channel");
  if (enabled && !channel) {
    await reply(interaction, "啟用管理紀錄時，請選擇紀錄頻道。");
    return;
  }
  await ctx.repos.guildConfig.update(interaction.guildId, {
    logChannelId: enabled ? channel?.id : null,
  });
  await reply(
    interaction,
    enabled ? `已設定管理紀錄頻道為 <#${channel?.id}>。` : "已停用管理紀錄。",
  );
}

async function setDynamicVoice(interaction: GuildChatInput, ctx: CommandContext): Promise<void> {
  const enabled = interaction.options.getBoolean("enabled", true);
  const channel = interaction.options.getChannel("channel");
  const current = await ctx.repos.guildConfig.ensure(interaction.guildId);
  const channelId = channel?.id ?? current.dynamicVoiceTriggerChannelId;
  if (enabled && !channelId) {
    await reply(interaction, "啟用動態語音頻道時，請選擇入口語音頻道。");
    return;
  }
  await ctx.repos.guildConfig.update(interaction.guildId, {
    dynamicVoiceTriggerChannelId: enabled ? channelId : null,
  });
  await reply(
    interaction,
    enabled ? `已啟用動態語音頻道，入口為 <#${channelId}>。` : "已停用動態語音頻道。",
  );
}

async function setActiveRole(interaction: GuildChatInput, ctx: CommandContext): Promise<void> {
  const role = interaction.options.getRole("role", true);
  await ctx.repos.guildConfig.update(interaction.guildId, { activeMemberRoleId: role.id });

  // Warn (don't block) if the bot can't actually manage this role.
  const me = interaction.guild?.members.me;
  const unmanageable =
    me && "comparePositionTo" in role && me.roles.highest.comparePositionTo(role) <= 0;
  const warnings = [
    unmanageable
      ? "⚠️ 此身分組高於我的最高身分組，我將無法發放/回收，請調整身分組順序。"
      : undefined,
    sensitiveRoleWarning(role.permissions),
  ].filter((line): line is string => Boolean(line));
  await reply(interaction, [`已設定活躍成員身分組為 <@&${role.id}>。`, ...warnings].join("\n"));
}

async function setThresholds(interaction: GuildChatInput, ctx: CommandContext): Promise<void> {
  const high = interaction.options.getInteger("high", true);
  const low = interaction.options.getInteger("low", true);
  if (high < low) {
    await reply(interaction, "高標必須 ≥ 低標。");
    return;
  }
  await ctx.repos.guildConfig.update(interaction.guildId, {
    activityThresholdHigh: high,
    activityThresholdLow: low,
  });
  await reply(interaction, `已設定門檻：高標 ${high}、低標 ${low}。`);
}

async function setWeights(interaction: GuildChatInput, ctx: CommandContext): Promise<void> {
  const weights: ActivityWeights = {
    chat: interaction.options.getInteger("chat", true),
    image: interaction.options.getInteger("image", true),
    music: interaction.options.getInteger("music", true),
    interaction: interaction.options.getInteger("interaction", true),
    voicePer10Min: interaction.options.getInteger("voice_per_10min", true),
  };
  await ctx.repos.guildConfig.update(interaction.guildId, { activityWeights: weights });
  await reply(interaction, "已更新活躍度權重。");
}

async function changeExempt(
  interaction: GuildChatInput,
  ctx: CommandContext,
  mode: "add" | "remove",
): Promise<void> {
  const role = interaction.options.getRole("role", true);
  const cfg: GuildConfig = await ctx.repos.guildConfig.ensure(interaction.guildId);
  const current = new Set(cfg.exemptRoleIds);

  if (mode === "add") current.add(role.id);
  else current.delete(role.id);

  await ctx.repos.guildConfig.update(interaction.guildId, { exemptRoleIds: [...current] });
  await reply(
    interaction,
    mode === "add" ? `已新增豁免身分組 <@&${role.id}>。` : `已移除豁免身分組 <@&${role.id}>。`,
  );
}

type ConfigHandler = (interaction: GuildChatInput, ctx: CommandContext) => Promise<void>;

const CONFIG_HANDLERS: Record<string, ConfigHandler> = {
  view,
  "active-role": setActiveRole,
  thresholds: setThresholds,
  weights: setWeights,
  "exempt-add": (interaction, ctx) => changeExempt(interaction, ctx, "add"),
  "exempt-remove": (interaction, ctx) => changeExempt(interaction, ctx, "remove"),
  welcome: setWelcome,
  "leave-log": setLeaveLog,
  "log-channel": setLogChannel,
  "dynamic-voice": setDynamicVoice,
};
