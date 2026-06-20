import {
  ChannelType,
  EmbedBuilder,
  type Guild,
  type GuildBasedChannel,
  type GuildMember,
  type GuildTextBasedChannel,
  PermissionFlagsBits,
} from "discord.js";
import type { ModerationLogEntry, Repositories } from "@lycohana/db";
import type { Logger } from "../logger";
import { errMessage } from "../errors";

export interface ModerationLogDeps {
  repos: Repositories;
  logger: Logger;
}

/** Fields the caller provides; the guild supplies `guildId`. */
export type ModerationEvent = Omit<ModerationLogEntry, "guildId">;

export interface ModerationLog {
  /**
   * Persist a moderation/system action and mirror it to the guild's log
   * channel when one is configured. Best-effort: never throws, so it is safe
   * to call from event handlers.
   */
  record(guild: Guild, event: ModerationEvent): Promise<void>;
}

export function createModerationLog(deps: ModerationLogDeps): ModerationLog {
  return {
    async record(guild, event) {
      try {
        await deps.repos.moderationLog.record({ guildId: guild.id, ...event });
      } catch (error) {
        deps.logger.error("moderation log: db write failed", {
          guild: guild.id,
          action: event.action,
          error: errMessage(error),
        });
      }
      await postToLogChannel(guild, event, deps);
    },
  };
}

async function postToLogChannel(
  guild: Guild,
  event: ModerationEvent,
  deps: ModerationLogDeps,
): Promise<void> {
  try {
    const config = await deps.repos.guildConfig.get(guild.id);
    if (!config?.logChannelId) return;
    const channel = await guild.channels.fetch(config.logChannelId).catch(() => null);
    if (!canSend(channel, guild.members.me)) {
      deps.logger.error("moderation log: channel missing or not writable", {
        guild: guild.id,
        channel: config.logChannelId,
      });
      return;
    }
    await channel.send({ embeds: [buildEmbed(event)] });
  } catch (error) {
    deps.logger.error("moderation log: post failed", {
      guild: guild.id,
      action: event.action,
      error: errMessage(error),
    });
  }
}

function buildEmbed(event: ModerationEvent): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("🛡️ 管理紀錄")
    .addFields({ name: "動作", value: event.action })
    .setTimestamp(new Date());
  if (event.targetUserId) embed.addFields({ name: "對象", value: `<@${event.targetUserId}>` });
  if (event.moderatorId) embed.addFields({ name: "執行者", value: `<@${event.moderatorId}>` });
  if (event.reason) embed.addFields({ name: "原因", value: event.reason });
  if (event.messageRef) embed.addFields({ name: "訊息", value: event.messageRef });
  return embed;
}

function canSend(
  channel: GuildBasedChannel | null,
  me: GuildMember | null,
): channel is GuildTextBasedChannel {
  if (!channel || !me) return false;
  if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
    return false;
  }
  // The log message is an embed, so EmbedLinks is required too — otherwise the
  // preflight passes but the Discord send fails and only surfaces in the catch.
  return channel
    .permissionsFor(me)
    .has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ]);
}
