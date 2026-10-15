/**
 * Active-member gate — pure hysteresis decision (spec §4.7). Grant at/above
 * the high threshold, revoke below the low threshold, hold in between. A null
 * threshold disables that side (never grant / never revoke).
 *
 * The rules live in one ordered table; the first matching rule decides. Each
 * rule names the message key that explains it (texts live in the bot's
 * messages file, not in code).
 */
export type ActiveMemberAction = "grant" | "revoke" | "none";

export interface ActiveMemberDecisionInput {
  score: number;
  high: number | null;
  low: number | null;
  hasRole: boolean;
}

/** Why revoking can never happen with this low threshold (scores are ≥ 0). */
export type RevokeDisabledReason = "revoke-disabled-low-null" | "revoke-disabled-low-zero";

/** Machine-readable reason behind a verdict. */
export type ActiveMemberDecisionReason =
  | "at-or-above-high"
  | "below-high"
  | "grant-disabled-high-null"
  | "below-low"
  | "at-or-above-low"
  | RevokeDisabledReason;

export interface ActiveMemberVerdict {
  action: "grant" | "revoke" | "hold";
  reason: ActiveMemberDecisionReason;
}

export interface ActiveMemberDecisionRule extends ActiveMemberVerdict {
  messageKey: string;
  when(input: ActiveMemberDecisionInput): boolean;
}

/** Ordered: the first rule whose `when` matches decides. The last always matches. */
export const ACTIVE_MEMBER_DECISION_RULES: readonly ActiveMemberDecisionRule[] = [
  {
    reason: "revoke-disabled-low-null",
    action: "hold",
    messageKey: "activeMember.reason.revoke-disabled-low-null",
    when: (i) => i.hasRole && i.low == null,
  },
  {
    reason: "below-low",
    action: "revoke",
    messageKey: "activeMember.reason.below-low",
    when: (i) => i.hasRole && i.low != null && i.score < i.low,
  },
  {
    reason: "revoke-disabled-low-zero",
    action: "hold",
    messageKey: "activeMember.reason.revoke-disabled-low-zero",
    when: (i) => i.hasRole && i.low != null && i.low <= 0,
  },
  {
    reason: "at-or-above-low",
    action: "hold",
    messageKey: "activeMember.reason.at-or-above-low",
    when: (i) => i.hasRole,
  },
  {
    reason: "grant-disabled-high-null",
    action: "hold",
    messageKey: "activeMember.reason.grant-disabled-high-null",
    when: (i) => i.high == null,
  },
  {
    reason: "at-or-above-high",
    action: "grant",
    messageKey: "activeMember.reason.at-or-above-high",
    when: (i) => i.high != null && i.score >= i.high,
  },
  {
    reason: "below-high",
    action: "hold",
    messageKey: "activeMember.reason.below-high",
    when: () => true,
  },
];

const CATCH_ALL = ACTIVE_MEMBER_DECISION_RULES[ACTIVE_MEMBER_DECISION_RULES.length - 1];

/** Explainable decision: the first matching rule's action and reason. */
export function explainActiveMember(input: ActiveMemberDecisionInput): ActiveMemberVerdict {
  const { action, reason } = ACTIVE_MEMBER_DECISION_RULES.find((r) => r.when(input)) ?? CATCH_ALL;
  return { action, reason };
}

export function decideActiveMember(input: ActiveMemberDecisionInput): ActiveMemberAction {
  const { action } = explainActiveMember(input);
  return action === "hold" ? "none" : action;
}

/** The reason revoking is impossible for this low threshold, if it is. */
export function revokeDisabledReason(low: number | null): RevokeDisabledReason | undefined {
  if (low == null) return "revoke-disabled-low-null";
  if (low <= 0) return "revoke-disabled-low-zero";
  return undefined;
}
