import type { ActivityCaps, ActivityDelta, Repositories } from "@lycohana/db";
import type { ActivityLimits } from "@lycohana/domain";
import type { Logger } from "../logger";

export { errMessage } from "../errors";

export interface ActivityTrackerDeps {
  repos: Repositories;
  logger: Logger;
  limits: ActivityLimits;
  timeZone: string;
}

function hasPositive(delta: ActivityDelta): boolean {
  return Object.values(delta).some((value) => typeof value === "number" && value > 0);
}

/**
 * Apply a delta to a member's daily counts (spec §4.5). The per-dimension daily
 * caps are enforced atomically by the repository (`LEAST(current + delta, cap)`),
 * so concurrent events can never push a capped counter past its limit. No-op if
 * the delta carries nothing positive.
 */
export async function applyDelta(
  repos: Repositories,
  guildId: string,
  userId: string,
  date: string,
  delta: ActivityDelta,
  limits: ActivityLimits,
): Promise<void> {
  if (!hasPositive(delta)) return;
  await repos.activity.increment(guildId, userId, date, delta, capsFrom(limits));
}

/** Map the runtime limits onto the repository's per-dimension cap contract. */
function capsFrom(limits: ActivityLimits): ActivityCaps {
  return {
    voiceSeconds: limits.voiceDailyCapSeconds,
    imageCount: limits.imageDailyCap,
    musicCount: limits.musicDailyCap,
    interactionCount: limits.interactionDailyCap,
  };
}
