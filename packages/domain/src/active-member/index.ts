/**
 * Active-member gate — pure hysteresis decision (spec §4.7). Grant at/above
 * the high threshold, revoke below the low threshold, hold in between. A null
 * threshold disables that side (never grant / never revoke).
 */
export type ActiveMemberAction = "grant" | "revoke" | "none";

export interface ActiveMemberDecisionInput {
  score: number;
  high: number | null;
  low: number | null;
  hasRole: boolean;
}

export function decideActiveMember(input: ActiveMemberDecisionInput): ActiveMemberAction {
  const { score, high, low, hasRole } = input;
  if (!hasRole && high != null && score >= high) return "grant";
  if (hasRole && low != null && score < low) return "revoke";
  return "none";
}
