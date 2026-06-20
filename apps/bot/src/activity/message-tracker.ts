import { type Client, Events, type Message } from "discord.js";
import { dateKey, detectMusicShare, isImageAttachment } from "@lycohana/domain";
import type { ActivityDelta } from "@lycohana/db";
import { applyDelta, errMessage, type ActivityTrackerDeps } from "./shared";

/**
 * Tracks chat / image / music / reply-interaction from messageCreate.
 * Chat counting uses the event only (with a per-member cooldown); image and
 * music read attachments / content (requires the MessageContent intent).
 */
export function registerMessageTracking(client: Client, deps: ActivityTrackerDeps): void {
  const { repos, logger, limits, timeZone } = deps;
  const lastChatAt = new Map<string, number>(); // `${guildId}:${userId}` -> epoch ms

  client.on(Events.MessageCreate, async (message) => {
    try {
      if (!message.inGuild()) return;
      if (message.author.bot || message.system) return;

      const now = Date.now();
      const { guildId } = message;
      const userId = message.author.id;
      const date = dateKey(new Date(now), timeZone);
      const delta = buildActivityDelta(message, now, lastChatAt, limits.chatCooldownMs);

      await applyDelta(repos, guildId, userId, date, delta, limits);
    } catch (error) {
      logger.error("message tracking failed", { error: errMessage(error) });
    }
  });
}

function buildActivityDelta(
  message: Message<true>,
  now: number,
  lastChatAt: Map<string, number>,
  chatCooldownMs: number,
): ActivityDelta {
  const delta: ActivityDelta = {};
  const key = `${message.guildId}:${message.author.id}`;
  if (now - (lastChatAt.get(key) ?? 0) >= chatCooldownMs) {
    lastChatAt.set(key, now);
    delta.chatCount = 1;
  }
  if (message.attachments.some((item) => isImageAttachment(item.name, item.contentType))) {
    delta.imageCount = 1;
  }
  if (detectMusicShare(message.content)) delta.musicCount = 1;

  const replied = message.mentions.repliedUser;
  if (replied && replied.id !== message.author.id && !replied.bot) delta.interactionCount = 1;
  return delta;
}
