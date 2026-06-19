import type { ActivityDelta, Repositories } from "@lycohana/db";
import { cappedDelta, type ActivityLimits } from "@lycohana/domain";
import type { Logger } from "../logger";

export interface ActivityTrackerDeps {
  repos: Repositories;
  logger: Logger;
  limits: ActivityLimits;
  timeZone: string;
}

export function errMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hasPositive(delta: ActivityDelta): boolean {
  return Object.values(delta).some((value) => typeof value === "number" && value > 0);
}

/**
 * Apply a delta to a member's daily counts, capping the interaction dimension
 * against today's total (spec §4.5). Mutates `delta`. No-op if nothing remains.
 */
export async function applyDelta(
  repos: Repositories,
  guildId: string,
  userId: string,
  date: string,
  delta: ActivityDelta,
  limits: ActivityLimits,
): Promise<void> {
  if (delta.interactionCount && delta.interactionCount > 0) {
    const day = await repos.activity.getDay(guildId, userId, date);
    const allowed = cappedDelta(
      day?.interactionCount ?? 0,
      delta.interactionCount,
      limits.interactionDailyCap,
    );
    if (allowed > 0) delta.interactionCount = allowed;
    else delete delta.interactionCount;
  }

  if (!hasPositive(delta)) return;
  await repos.activity.increment(guildId, userId, date, delta);
}
