import type { ActivityWeights } from "./types";

/** Starting weights from spec §4.8; tunable later via guild config. */
export const DEFAULT_ACTIVITY_WEIGHTS: ActivityWeights = {
  chat: 1,
  image: 3,
  music: 3,
  interaction: 1,
  voicePer10Min: 2,
};

/**
 * Timezone used to bucket activity into calendar days (spec §4.6). The
 * community is Taiwan-based; tunable later.
 */
export const ACTIVITY_TIME_ZONE = "Asia/Taipei";

/** Rolling window (days) for the active-member score (spec §4.6). */
export const ACTIVE_MEMBER_WINDOW_DAYS = 30;

/** Anti-gaming limits (spec §4.4, §4.5). Tunable post-launch (spec §8). */
export interface ActivityLimits {
  /** Min gap between two counted chat messages from the same member. */
  chatCooldownMs: number;
  /** Max voice seconds a member can accrue per day. */
  voiceDailyCapSeconds: number;
  /** Max interactions (replies + reactions given) counted per day. */
  interactionDailyCap: number;
}

export const DEFAULT_ACTIVITY_LIMITS: ActivityLimits = {
  chatCooldownMs: 60_000,
  voiceDailyCapSeconds: 4 * 60 * 60,
  interactionDailyCap: 20,
};
