import {
  ChannelType,
  type Client,
  Events,
  type GuildBasedChannel,
  type GuildMember,
  type GuildTextBasedChannel,
  PermissionFlagsBits,
} from "discord.js";
import type { Repositories } from "@lycohana/db";
import type { Logger } from "../logger";
import { errMessage } from "../errors";

export interface MemberEventDeps {
  repos: Repositories;
  logger: Logger;
}

export function registerMemberEvents(client: Client, deps: MemberEventDeps): void {
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      const config = await deps.repos.guildConfig.get(member.guild.id);
      if (!config?.welcomeEnabled || !config.welcomeChannelId) return;
      const channel = await member.guild.channels.fetch(config.welcomeChannelId).catch(() => null);
      if (!canSend(channel, member.guild.members.me)) {
        deps.logger.error("welcome: channel missing or not writable", {
          guild: member.guild.id,
          channel: config.welcomeChannelId,
        });
        return;
      }
      await channel.send(`歡迎 <@${member.id}> 來到 **${member.guild.name}**！`);
      deps.logger.info("welcome sent", { guild: member.guild.id, user: member.id });
    } catch (error) {
      deps.logger.error("welcome failed", {
        guild: member.guild.id,
        user: member.id,
        error: errMessage(error),
      });
    }
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    try {
      const config = await deps.repos.guildConfig.get(member.guild.id);
      if (!config?.leaveLogChannelId) return;
      const channel = await member.guild.channels.fetch(config.leaveLogChannelId).catch(() => null);
      if (!canSend(channel, member.guild.members.me)) {
        deps.logger.error("leave log: channel missing or not writable", {
          guild: member.guild.id,
          channel: config.leaveLogChannelId,
        });
        return;
      }
      await channel.send(`成員離開：**${member.user.tag}**（${member.id}）`);
      deps.logger.info("leave logged", { guild: member.guild.id, user: member.id });
    } catch (error) {
      deps.logger.error("leave log failed", {
        guild: member.guild.id,
        user: member.id,
        error: errMessage(error),
      });
    }
  });
}

function canSend(
  channel: GuildBasedChannel | null,
  me: GuildMember | null,
): channel is GuildTextBasedChannel {
  if (!channel || !me) return false;
  if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
    return false;
  }
  return channel
    .permissionsFor(me)
    .has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]);
}
