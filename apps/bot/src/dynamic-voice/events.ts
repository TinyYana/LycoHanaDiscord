import {
  ChannelType,
  type Client,
  Events,
  type Guild,
  type GuildMember,
  PermissionFlagsBits,
  RESTJSONErrorCodes,
  type VoiceChannel,
  type VoiceState,
} from "discord.js";
import type { DynamicVoiceChannel, Repositories } from "@lycohana/db";
import { errMessage } from "../errors";
import type { Logger } from "../logger";
import { dynamicVoiceChannelName } from "./name";

export interface DynamicVoiceDeps {
  repos: Repositories;
  logger: Logger;
}

export function registerDynamicVoice(client: Client, deps: DynamicVoiceDeps): void {
  const creating = new Set<string>();

  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    await createFromTrigger(newState, deps, creating).catch((error: unknown) => {
      deps.logger.error("dynamic voice creation failed", voiceErrorFields(newState, error));
    });
    await deleteIfEmpty(oldState, newState, deps).catch((error: unknown) => {
      deps.logger.error("dynamic voice cleanup failed", voiceErrorFields(oldState, error));
    });
  });

  client.on(Events.ChannelDelete, async (channel) => {
    await deps.repos.dynamicVoice.remove(channel.id).catch((error: unknown) => {
      deps.logger.error("dynamic voice record cleanup failed", {
        channel: channel.id,
        error: errMessage(error),
      });
    });
  });

  client.once(Events.ClientReady, async (readyClient) => {
    await reconcileManagedChannels(readyClient, deps).catch((error: unknown) => {
      deps.logger.error("dynamic voice startup reconciliation failed", {
        error: errMessage(error),
      });
    });
  });
}

async function createFromTrigger(
  state: VoiceState,
  deps: DynamicVoiceDeps,
  creating: Set<string>,
): Promise<void> {
  const member = state.member;
  if (!member || member.user.bot || !state.channelId) return;

  const config = await deps.repos.guildConfig.get(state.guild.id);
  if (state.channelId !== config?.dynamicVoiceTriggerChannelId) return;

  const key = `${state.guild.id}:${member.id}`;
  if (creating.has(key)) return;
  creating.add(key);
  try {
    await createAndMove(member, state, deps);
  } finally {
    creating.delete(key);
  }
}

async function createAndMove(
  member: GuildMember,
  state: VoiceState,
  deps: DynamicVoiceDeps,
): Promise<void> {
  const channel = await state.guild.channels.create({
    name: dynamicVoiceChannelName(member.displayName),
    type: ChannelType.GuildVoice,
    parent: state.channel?.parentId ?? null,
    permissionOverwrites: [
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageRoles,
        ],
      },
    ],
    reason: `Dynamic voice channel for ${member.user.tag}`,
  });

  let persisted = false;
  try {
    await deps.repos.dynamicVoice.add({
      channelId: channel.id,
      guildId: state.guild.id,
      ownerId: member.id,
    });
    persisted = true;
    if (member.voice.channelId !== state.channelId) {
      throw new Error("member left the dynamic voice trigger before the channel was ready");
    }
    await member.voice.setChannel(channel, "建立動態語音頻道");
    deps.logger.info("dynamic voice channel created", {
      guild: state.guild.id,
      channel: channel.id,
      owner: member.id,
    });
  } catch (error) {
    await rollbackChannel(channel, persisted, deps);
    throw error;
  }
}

async function rollbackChannel(
  channel: VoiceChannel,
  persisted: boolean,
  deps: DynamicVoiceDeps,
): Promise<void> {
  try {
    await channel.delete("動態語音頻道建立或移動失敗，回滾空頻道");
    if (persisted) await deps.repos.dynamicVoice.remove(channel.id);
  } catch (error) {
    deps.logger.error("dynamic voice rollback failed", {
      channel: channel.id,
      error: errMessage(error),
    });
  }
}

async function deleteIfEmpty(
  oldState: VoiceState,
  newState: VoiceState,
  deps: DynamicVoiceDeps,
): Promise<void> {
  if (!oldState.channel || oldState.channelId === newState.channelId) return;
  const managed = await deps.repos.dynamicVoice.get(oldState.channel.id);
  if (!managed || oldState.channel.members.size > 0) return;

  await oldState.channel.delete("動態語音頻道已空，進行清理");
  await deps.repos.dynamicVoice.remove(oldState.channel.id);
  deps.logger.info("empty dynamic voice channel deleted", {
    guild: oldState.guild.id,
    channel: oldState.channel.id,
  });
}

async function reconcileManagedChannels(
  client: Client<true>,
  deps: DynamicVoiceDeps,
): Promise<void> {
  const records = await deps.repos.dynamicVoice.list();
  for (const record of records) await reconcileChannel(client, record, deps);
}

async function reconcileChannel(
  client: Client<true>,
  record: DynamicVoiceChannel,
  deps: DynamicVoiceDeps,
): Promise<void> {
  const guild = client.guilds.cache.get(record.guildId);
  if (!guild) {
    deps.logger.warn("dynamic voice guild unavailable during reconciliation", {
      guild: record.guildId,
      channel: record.channelId,
    });
    return;
  }

  const channel = await fetchManagedChannel(guild, record, deps);
  if (!channel) return;
  if (!channel.isVoiceBased()) {
    await deps.repos.dynamicVoice.remove(record.channelId);
    deps.logger.warn("dynamic voice record pointed to a non-voice channel", {
      guild: record.guildId,
      channel: record.channelId,
    });
    return;
  }
  if (channel.members.size > 0) return;

  await channel.delete("Bot 啟動時清理空的動態語音頻道");
  await deps.repos.dynamicVoice.remove(record.channelId);
  deps.logger.info("stale dynamic voice channel deleted", {
    guild: record.guildId,
    channel: record.channelId,
  });
}

async function fetchManagedChannel(
  guild: Guild,
  record: DynamicVoiceChannel,
  deps: DynamicVoiceDeps,
) {
  try {
    const channel = await guild.channels.fetch(record.channelId);
    if (!channel) await deps.repos.dynamicVoice.remove(record.channelId);
    return channel;
  } catch (error) {
    if (discordErrorCode(error) === RESTJSONErrorCodes.UnknownChannel) {
      await deps.repos.dynamicVoice.remove(record.channelId);
      return null;
    }
    throw error;
  }
}

function discordErrorCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof error.code === "number" ? error.code : undefined;
}

function voiceErrorFields(state: VoiceState, error: unknown): Record<string, unknown> {
  return {
    guild: state.guild.id,
    user: state.id,
    channel: state.channelId,
    error: errMessage(error),
  };
}
