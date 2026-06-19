import { type Client, Events } from "discord.js";
import { dateKey } from "@lycohana/domain";
import { applyDelta, errMessage, type ActivityTrackerDeps } from "./shared";

/**
 * Counts a reaction *given* by a member as an interaction (spec §4.5).
 * Resolves partials so reactions on uncached messages still count.
 */
export function registerReactionTracking(client: Client, deps: ActivityTrackerDeps): void {
  const { repos, logger, limits, timeZone } = deps;

  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
      if (user.partial) user = await user.fetch();
      if (user.bot) return;

      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();

      const guildId = reaction.message.guildId;
      if (!guildId) return; // DM reaction

      const date = dateKey(new Date(), timeZone);
      await applyDelta(repos, guildId, user.id, date, { interactionCount: 1 }, limits);
    } catch (error) {
      logger.error("reaction tracking failed", { error: errMessage(error) });
    }
  });
}
