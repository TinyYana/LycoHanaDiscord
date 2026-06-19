import { type Client, Events } from "discord.js";
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
      const delta: ActivityDelta = {};

      // Chat — cooldown-limited; never reads message text.
      const key = `${guildId}:${userId}`;
      if (now - (lastChatAt.get(key) ?? 0) >= limits.chatCooldownMs) {
        lastChatAt.set(key, now);
        delta.chatCount = 1;
      }

      // Image — any image-like attachment.
      if (message.attachments.some((a) => isImageAttachment(a.name, a.contentType))) {
        delta.imageCount = 1;
      }

      // Music — known music-service link in content.
      if (detectMusicShare(message.content)) {
        delta.musicCount = 1;
      }

      // Interaction — reply directed at another (non-bot) user.
      const replied = message.mentions.repliedUser;
      if (replied && replied.id !== userId && !replied.bot) {
        delta.interactionCount = 1;
      }

      await applyDelta(repos, guildId, userId, date, delta, limits);
    } catch (error) {
      logger.error("message tracking failed", { error: errMessage(error) });
    }
  });
}
