/**
 * Activity domain — pure value types shared across layers.
 *
 * The five participation dimensions tracked per member (spec §2.1, §4.2).
 * No discord.js / drizzle here: this is the contract `db` persists and the
 * scorer (M3/M4) computes against.
 */

/** Raw per-member participation counts (one member, one window). */
export interface ActivityCounts {
  chatCount: number;
  voiceSeconds: number;
  imageCount: number;
  musicCount: number;
  interactionCount: number;
}

/**
 * Weight applied to each dimension when collapsing counts into a single
 * active-member score (spec §4.8). Voice is weighted per 10 minutes.
 */
export interface ActivityWeights {
  chat: number;
  image: number;
  music: number;
  interaction: number;
  voicePer10Min: number;
}

/**
 * Hysteresis gate for the active-member role (spec §4.7): grant at/above
 * `high`, revoke below `low`, hold in between. Nullable until an admin
 * configures them (spec §4.8).
 */
export interface ActivityThresholds {
  high: number | null;
  low: number | null;
}

/** Starting weights from spec §4.8; tunable later via guild config. */
export const DEFAULT_ACTIVITY_WEIGHTS: ActivityWeights = {
  chat: 1,
  image: 3,
  music: 3,
  interaction: 1,
  voicePer10Min: 2,
};
