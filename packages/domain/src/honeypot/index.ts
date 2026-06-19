/**
 * Honeypot domain — action taken when a non-exempt member posts in a
 * honeypot channel (spec §5.7, §6 M8). `timeout` is the safe default; `ban`
 * is opt-in by an admin.
 */

export const HONEYPOT_ACTIONS = ["ban", "timeout"] as const;

export type HoneypotAction = (typeof HONEYPOT_ACTIONS)[number];
