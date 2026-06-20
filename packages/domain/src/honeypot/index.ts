/**
 * Honeypot domain — action taken when a non-exempt member posts in a
 * honeypot channel (spec §5.7, §6 M8). `timeout` is the safe default; `ban`
 * is opt-in by an admin.
 */

export const HONEYPOT_ACTIONS = ["ban", "timeout"] as const;

export type HoneypotAction = (typeof HONEYPOT_ACTIONS)[number];

/**
 * Default timeout applied when a honeypot channel uses the `timeout` action
 * but has no per-channel duration set. Overridable via env (spec §8); a
 * per-channel value takes precedence. Discord caps a timeout at 28 days.
 */
export const DEFAULT_HONEYPOT_TIMEOUT_SECONDS = 600;
