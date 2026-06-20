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
  /**
   * How long a bot-created channel may sit empty before it is deleted. A grace
   * window lets the owner briefly disconnect/reconnect without losing the room.
   * 0 means delete immediately.
   */
  emptyGraceMs: number;
}

export function registerDynamicVoice(client: Client, deps: DynamicVoiceDeps): void {
  const creating = new Set<string>();
  // Channels waiting out their empty-grace window, keyed by channel id.
  const pendingCleanup = new Map<string, NodeJS.Timeout>();

  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    // Resolve the trigger channel once and hand it to both paths. The trigger
    // is operator-owned and must be filtered out of cleanup entirely.
    let triggerChannelId: string | null;
    try {
      const config = await deps.repos.guildConfig.get(newState.guild.id);
      triggerChannelId = config?.dynamicVoiceTriggerChannelId ?? null;
    } catch (error: unknown) {
      deps.logger.error("dynamic voice config lookup failed", voiceErrorFields(newState, error));
      return;
    }

    await createFromTrigger(newState, triggerChannelId, deps, creating).catch((error: unknown) => {
      deps.logger.error("dynamic voice creation failed", voiceErrorFields(newState, error));
    });

    // Someone (re)joined a channel that was counting down to deletion — keep it.
    if (newState.channelId) cancelCleanup(newState.channelId, pendingCleanup);

    await scheduleCleanupIfEmpty(oldState, newState, triggerChannelId, deps, pendingCleanup).catch(
      (error: unknown) => {
        deps.logger.error("dynamic voice cleanup failed", voiceErrorFields(oldState, error));
      },
    );
  });

  client.on(Events.ChannelDelete, async (channel) => {
    cancelCleanup(channel.id, pendingCleanup);
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
  triggerChannelId: string | null,
  deps: DynamicVoiceDeps,
  creating: Set<string>,
): Promise<void> {
  const member = state.member;
  if (!member || member.user.bot || !state.channelId) return;
  if (!triggerChannelId || state.channelId !== triggerChannelId) return;

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

async function scheduleCleanupIfEmpty(
  oldState: VoiceState,
  newState: VoiceState,
  triggerChannelId: string | null,
  deps: DynamicVoiceDeps,
  pending: Map<string, NodeJS.Timeout>,
): Promise<void> {
  // `oldState.channel` is a live cache getter; capture the id up front.
  const channel = oldState.channel;
  if (!channel || oldState.channelId === newState.channelId) return;
  // The trigger channel is operator-owned, never bot-managed: filter it out
  // before any lookup so it can never be deleted by cleanup.
  if (channel.id === triggerChannelId) return;
  const managed = await deps.repos.dynamicVoice.get(channel.id);
  if (!managed || channel.members.size > 0) return;

  if (deps.emptyGraceMs <= 0) {
    await runCleanup(channel.id, oldState.guild, deps, pending);
    return;
  }
  scheduleCleanup(channel.id, oldState.guild, deps, pending);
}

/** Arm (once) a delayed cleanup for an emptied channel after the grace window. */
function scheduleCleanup(
  channelId: string,
  guild: Guild,
  deps: DynamicVoiceDeps,
  pending: Map<string, NodeJS.Timeout>,
): void {
  if (pending.has(channelId)) return; // already counting down

  const timer = setTimeout(() => {
    void runCleanup(channelId, guild, deps, pending).catch((error: unknown) => {
      deps.logger.error("dynamic voice delayed cleanup failed", {
        guild: guild.id,
        channel: channelId,
        error: errMessage(error),
      });
    });
  }, deps.emptyGraceMs);
  // A pending room cleanup should never keep the process alive on its own.
  timer.unref?.();
  pending.set(channelId, timer);
}

function cancelCleanup(channelId: string, pending: Map<string, NodeJS.Timeout>): void {
  const timer = pending.get(channelId);
  if (!timer) return;
  clearTimeout(timer);
  pending.delete(channelId);
}

/** Delete a managed channel iff it is still tracked and still empty. */
async function runCleanup(
  channelId: string,
  guild: Guild,
  deps: DynamicVoiceDeps,
  pending: Map<string, NodeJS.Timeout>,
): Promise<void> {
  pending.delete(channelId);
  const managed = await deps.repos.dynamicVoice.get(channelId);
  if (!managed) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel || !channel.isVoiceBased()) {
    await deps.repos.dynamicVoice.remove(channelId);
    return;
  }
  if (channel.members.size > 0) return; // someone came back during the grace window

  await channel.delete("動態語音頻道空置逾時，進行清理");
  await deps.repos.dynamicVoice.remove(channelId);
  deps.logger.info("empty dynamic voice channel deleted", { guild: guild.id, channel: channelId });
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

  // Guard against a stale record that points at the configured trigger channel.
  const config = await deps.repos.guildConfig.get(record.guildId);
  if (record.channelId === config?.dynamicVoiceTriggerChannelId) {
    await deps.repos.dynamicVoice.remove(record.channelId);
    deps.logger.warn("dynamic voice record matched the trigger channel; skipping deletion", {
      guild: record.guildId,
      channel: record.channelId,
    });
    return;
  }

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
