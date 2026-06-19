import type { ActivityCounts, ActivityWeights } from "./types";

/**
 * Collapse raw counts into a single weighted activity score (spec §4.8).
 * Voice contributes per 10 minutes. Used by /activity stats (M3) and the
 * active-member gate (M4).
 */
export function computeActivityScore(counts: ActivityCounts, weights: ActivityWeights): number {
  return (
    counts.chatCount * weights.chat +
    counts.imageCount * weights.image +
    counts.musicCount * weights.music +
    counts.interactionCount * weights.interaction +
    (counts.voiceSeconds / 600) * weights.voicePer10Min
  );
}

/**
 * How much of `delta` may be added before hitting `cap`, given `current`
 * already accrued today. Never negative.
 */
export function cappedDelta(current: number, delta: number, cap: number): number {
  if (delta <= 0) return 0;
  return Math.min(delta, Math.max(0, cap - current));
}
