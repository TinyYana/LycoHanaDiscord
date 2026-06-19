import { type Client, Events, type VoiceBasedChannel } from "discord.js";
import { cappedDelta, dateKey } from "@lycohana/domain";
import { errMessage, type ActivityTrackerDeps } from "./shared";

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

  function humanIds(channel: VoiceBasedChannel): Set<string> {
    const ids = new Set<string>();
    for (const member of channel.members.values()) {
      if (!member.user.bot) ids.add(member.id);
    }
    return ids;
  }

  async function flush(userId: string, now: number): Promise<void> {
    const acc = accruing.get(userId);
    if (!acc) return;
    accruing.delete(userId);

    const seconds = Math.floor((now - acc.since) / 1000);
    if (seconds <= 0) return;

    const date = dateKey(new Date(now), timeZone);
    const day = await repos.activity.getDay(acc.guildId, userId, date);
    const allowed = cappedDelta(day?.voiceSeconds ?? 0, seconds, limits.voiceDailyCapSeconds);
    if (allowed > 0) {
      await repos.activity.increment(acc.guildId, userId, date, { voiceSeconds: allowed });
    }
  }

  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    const now = Date.now();
    try {
      const guild = newState.guild;
      const afkChannelId = guild.afkChannelId;

      const affected: VoiceBasedChannel[] = [];
      if (oldState.channel) affected.push(oldState.channel);
      if (newState.channel && newState.channel.id !== oldState.channel?.id) {
        affected.push(newState.channel);
      }

      for (const channel of affected) {
        const humans = humanIds(channel);
        const eligible = channel.id !== afkChannelId && humans.size >= 2;

        // Start accrual for eligible humans not already accruing.
        if (eligible) {
          for (const userId of humans) {
            if (!accruing.has(userId)) {
              accruing.set(userId, { guildId: guild.id, channelId: channel.id, since: now });
            }
          }
        }

        // Stop accrual for members in this channel who are no longer eligible
        // (left, or the channel dropped below two humans / became AFK).
        for (const [userId, acc] of [...accruing.entries()]) {
          if (acc.channelId !== channel.id) continue;
          if (!eligible || !humans.has(userId)) await flush(userId, now);
        }
      }
    } catch (error) {
      logger.error("voice tracking failed", { error: errMessage(error) });
    }
  });
}
