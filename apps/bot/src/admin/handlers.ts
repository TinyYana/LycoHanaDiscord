import { ACTIVE_MEMBER_SETTING_FIELDS } from "@lycohana/domain";
import {
  ACTIVE_MEMBER_SKIP_REASONS,
  type ActiveMemberCandidatePlan,
  candidateReasonText,
  planActiveMemberGuild,
  skipReasonText,
  type SweepSkipReason,
} from "../active-member";
import { RUNTIME_METRICS } from "../runtime-status/metrics";
import type { Messages } from "../messages";
import { type AdminDeps, type AdminRequest, type AdminResult, okJson, requireGuild } from "./types";

/** Page text (every `admin.*` message), the settings form declaration and the CSRF token. */
export function bootstrap({ messages }: AdminDeps, req: AdminRequest): AdminResult {
  return okJson({
    csrfToken: req.csrfToken,
    text: messages.withPrefix("admin."),
    settingFields: ACTIVE_MEMBER_SETTING_FIELDS.map((field) => ({
      key: field.key,
      group: field.group,
      label: messages.t(field.labelKey),
      description: messages.t(field.descriptionKey),
      min: field.min,
      nullable: field.nullable,
    })),
  });
}

export function listGuilds({ client }: AdminDeps): AdminResult {
  const guilds = [...client.guilds.cache.values()]
    .map((guild) => ({ id: guild.id, name: guild.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return okJson({ guilds });
}

/** A sweep reason is either a skip code (shown as text) or an error message. */
function sweepReasonText(messages: Messages, reason: string | undefined): string | null {
  if (!reason) return null;
  return Object.hasOwn(ACTIVE_MEMBER_SKIP_REASONS, reason)
    ? skipReasonText(messages, reason as SweepSkipReason)
    : reason;
}

export function status({ runtimeStatus, messages, client }: AdminDeps): AdminResult {
  const snapshot = runtimeStatus.snapshot();
  const last = snapshot.sweep.last;
  return okJson({
    metrics: RUNTIME_METRICS.map((metric) => ({
      id: metric.id,
      name: messages.t(metric.nameKey),
      unit: metric.unitKey ? messages.t(metric.unitKey) : null,
      value: metric.read(snapshot, messages),
    })),
    lastSweep: last && {
      status: last.status,
      reasonText: sweepReasonText(messages, last.reason),
      guilds: last.guilds.map((g) => ({
        guildId: g.guildId,
        name: client.guilds.cache.get(g.guildId)?.name ?? g.guildId,
        status: g.status,
        reasonText: sweepReasonText(messages, g.reason),
        granted: g.granted,
        revoked: g.revoked,
        failed: g.failed,
      })),
    },
  });
}

function candidateView(messages: Messages, candidate: ActiveMemberCandidatePlan) {
  return {
    ...candidate,
    score: Math.round(candidate.score * 100) / 100,
    actionText: messages.t(`admin.action.${candidate.action}`),
    reasonText: candidateReasonText(messages, candidate.reason),
  };
}

/** What the next sweep would do. Read-only: never adds or removes a role. */
export async function preview(deps: AdminDeps, req: AdminRequest): Promise<AdminResult> {
  const { messages, config } = deps;
  const guild = requireGuild(deps, req.params.guildId);
  const plan = await planActiveMemberGuild(
    guild,
    deps.repos,
    { windowDays: config.activeMemberWindowDays, timeZone: config.timeZone },
    new Date(),
  );
  const candidates = plan.candidates
    .map((candidate) => candidateView(messages, candidate))
    .sort((a, b) => b.score - a.score);
  return okJson({
    roleId: plan.roleId,
    roleName: plan.roleId ? (guild.roles.cache.get(plan.roleId)?.name ?? plan.roleId) : null,
    high: plan.high,
    low: plan.low,
    window: plan.window,
    skipText: plan.skipReason ? skipReasonText(messages, plan.skipReason) : null,
    revokeDisabledText: plan.revokeDisabled
      ? candidateReasonText(messages, plan.revokeDisabled)
      : null,
    counts: Object.fromEntries(
      (["grant", "revoke", "hold", "skip"] as const).map((action) => [
        action,
        candidates.filter((c) => c.action === action).length,
      ]),
    ),
    candidates,
  });
}
