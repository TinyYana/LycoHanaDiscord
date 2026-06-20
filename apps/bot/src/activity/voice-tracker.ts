import { type Client, Events, type VoiceBasedChannel, type VoiceState } from "discord.js";
import { dateKey } from "@lycohana/domain";
import { applyDelta, errMessage, type ActivityTrackerDeps } from "./shared";

interface Accrual {
  guildId: string;
  channelId: string;
  since: number;
}

/**
 * Accrues voice_seconds while a member sits in a non-AFK channel with at least
 * two humans (spec §4.4). Sessions live in memory; an in-progress session is
 * lost on restart (acceptable per spec). Self-mute is not excluded. Daily cap
 * is enforced at flush time.
 */
export function registerVoiceTracking(client: Client, deps: ActivityTrackerDeps): void {
  const { repos, logger, limits, timeZone } = deps;
  const accruing = new Map<string, Accrual>(); // userId -> accrual

  async function flush(userId: string, now: number): Promise<void> {
    const acc = accruing.get(userId);
    if (!acc) return;
    accruing.delete(userId);

    const seconds = Math.floor((now - acc.since) / 1000);
    if (seconds <= 0) return;

    // The daily cap is enforced atomically inside the repository, so we hand
    // over the raw seconds and let `LEAST(current + delta, cap)` clamp them.
    const date = dateKey(new Date(now), timeZone);
    await applyDelta(repos, acc.guildId, userId, date, { voiceSeconds: seconds }, limits);
  }

  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    const now = Date.now();
    try {
      const guild = newState.guild;
      for (const channel of affectedChannels(oldState, newState)) {
        await syncChannelAccrual(channel, guild.id, guild.afkChannelId, now, accruing, flush);
      }
    } catch (error) {
      logger.error("voice tracking failed", { error: errMessage(error) });
    }
  });
}

function humanIds(channel: VoiceBasedChannel): Set<string> {
  return new Set(
    [...channel.members.values()].filter((member) => !member.user.bot).map((member) => member.id),
  );
}

function affectedChannels(oldState: VoiceState, newState: VoiceState): VoiceBasedChannel[] {
  const channels: VoiceBasedChannel[] = [];
  if (oldState.channel) channels.push(oldState.channel);
  if (newState.channel && newState.channel.id !== oldState.channel?.id)
    channels.push(newState.channel);
  return channels;
}

async function syncChannelAccrual(
  channel: VoiceBasedChannel,
  guildId: string,
  afkChannelId: string | null,
  now: number,
  accruing: Map<string, Accrual>,
  flush: (userId: string, now: number) => Promise<void>,
): Promise<void> {
  const humans = humanIds(channel);
  const eligible = channel.id !== afkChannelId && humans.size >= 2;
  if (eligible) startAccrual(channel.id, guildId, humans, now, accruing);
  await stopIneligibleAccrual(channel.id, humans, eligible, now, accruing, flush);
}

function startAccrual(
  channelId: string,
  guildId: string,
  humanIds: Set<string>,
  now: number,
  accruing: Map<string, Accrual>,
): void {
  for (const userId of humanIds) {
    if (!accruing.has(userId)) accruing.set(userId, { guildId, channelId, since: now });
  }
}

async function stopIneligibleAccrual(
  channelId: string,
  humanIds: Set<string>,
  eligible: boolean,
  now: number,
  accruing: Map<string, Accrual>,
  flush: (userId: string, now: number) => Promise<void>,
): Promise<void> {
  for (const [userId, accrual] of [...accruing.entries()]) {
    if (accrual.channelId !== channelId) continue;
    if (!eligible || !humanIds.has(userId)) await flush(userId, now);
  }
}
