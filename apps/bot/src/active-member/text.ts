import { ACTIVE_MEMBER_DECISION_RULES, type ActiveMemberSettingsIssue } from "@lycohana/domain";
import type { Messages } from "../messages";
import {
  ACTIVE_MEMBER_CANDIDATE_SKIP_REASONS,
  ACTIVE_MEMBER_SKIP_REASONS,
  type ActiveMemberCandidatePlan,
  type SweepSkipReason,
} from "./plan";

/** Message key for every candidate reason: decision rules plus pre-decision skips. */
const CANDIDATE_REASON_KEYS: Record<string, string> = Object.fromEntries([
  ...ACTIVE_MEMBER_DECISION_RULES.map((rule) => [rule.reason, rule.messageKey]),
  ...Object.entries(ACTIVE_MEMBER_CANDIDATE_SKIP_REASONS).map(([reason, v]) => [
    reason,
    v.messageKey,
  ]),
]);

/** Human-readable text for a candidate's reason (decision or skip). */
export function candidateReasonText(
  messages: Messages,
  reason: ActiveMemberCandidatePlan["reason"],
): string {
  return messages.t(CANDIDATE_REASON_KEYS[reason] ?? reason);
}

/** Human-readable text for a guild/sweep skip reason. */
export function skipReasonText(messages: Messages, reason: SweepSkipReason): string {
  return messages.t(ACTIVE_MEMBER_SKIP_REASONS[reason].messageKey);
}

/** Human-readable text for a settings validation error or warning. */
export function settingsIssueText(messages: Messages, issue: ActiveMemberSettingsIssue): string {
  const label = issue.labelKey ? messages.t(issue.labelKey) : "";
  return messages.t(issue.messageKey, { ...issue.params, label });
}
