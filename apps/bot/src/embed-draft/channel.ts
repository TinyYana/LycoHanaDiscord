import {
  ChannelType,
  type Guild,
  type GuildTextBasedChannel,
  PermissionFlagsBits,
} from "discord.js";

export type WritableEmbedChannelResult =
  | { ok: true; channel: GuildTextBasedChannel }
  | { ok: false; message: string };

export async function resolveWritableEmbedChannel(
  guild: Guild,
  channelId: string,
): Promise<WritableEmbedChannelResult> {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (
    !channel ||
    (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)
  ) {
    return { ok: false, message: "目標頻道不存在或不是文字／公告頻道。" };
  }

  const me = guild.members.me;
  const permissions = me ? channel.permissionsFor(me) : null;
  if (
    !permissions?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ])
  ) {
    return { ok: false, message: "我沒有在該頻道發送 Embed 的權限。" };
  }

  return { ok: true, channel };
}
