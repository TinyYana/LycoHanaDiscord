import type { Guild } from "discord.js";
import type { RevokeDisabledReason } from "@lycohana/domain";
import type { Logger } from "../logger";
import type { Messages } from "../messages";
import { errMessage } from "../errors";
import {
  ACTIVE_MEMBER_SKIP_REASONS,
  type ActiveMemberCandidatePlan,
  type ActiveMemberPlanRepos,
  type ActiveMemberWindowOptions,
  planActiveMemberGuild,
  type SweepSkipReason,
} from "./plan";
import { candidateReasonText, skipReasonText } from "./text";

export interface ActiveMemberDeps extends ActiveMemberWindowOptions {
  repos: ActiveMemberPlanRepos;
  logger: Logger;
  messages: Messages;
}

export type SweepStatus = "ok" | "failed" | "skipped";

export interface GuildSweepResult {
  guildId: string;
  status: SweepStatus;
  /** Skip reason (`skipped`) or error message (`failed`). */
  reason?: string;
  candidates: number;
  granted: number;
  revoked: number;
  failed: number;
  revokeDisabled?: RevokeDisabledReason;
}

export interface ActiveMemberSweepResult {
  status: SweepStatus;
  /** Why the whole sweep was skipped (e.g. "client not ready"). */
  reason?: string;
  startedAt: string;
  finishedAt: string;
  guilds: GuildSweepResult[];
}

/** Log a skip at the level its reason table entry asks for, with readable text. */
export function logSweepSkip(
  deps: Pick<ActiveMemberDeps, "logger" | "messages">,
  reason: SweepSkipReason,
  fields: Record<string, unknown> = {},
): void {
  deps.logger[ACTIVE_MEMBER_SKIP_REASONS[reason].level]("active member sweep skipped", {
    ...fields,
    reason,
    reasonText: skipReasonText(deps.messages, reason),
  });
}

function emptyGuildResult(guildId: string, status: SweepStatus, reason?: string): GuildSweepResult {
  return { guildId, status, reason, candidates: 0, granted: 0, revoked: 0, failed: 0 };
}

async function applyCandidate(
  guild: Guild,
  roleId: string,
  candidate: ActiveMemberCandidatePlan,
  result: GuildSweepResult,
  deps: ActiveMemberDeps,
): Promise<void> {
  const { logger } = deps;
  const { action, userId, score, reason } = candidate;
  if (action !== "grant" && action !== "revoke") return;
  const member = guild.members.cache.get(userId);
  try {
    if (!member) throw new Error("member no longer cached");
    if (action === "grant") await member.roles.add(roleId, "active-member gate");
    else await member.roles.remove(roleId, "active-member gate");
    result[action === "grant" ? "granted" : "revoked"] += 1;
    logger.info(`active member ${action === "grant" ? "granted" : "revoked"}`, {
      guild: guild.id,
      user: userId,
      score,
      reason,
      reasonText: candidateReasonText(deps.messages, reason),
    });
  } catch (error) {
    result.failed += 1;
    logger.error("active member: role change failed", {
      guild: guild.id,
      user: userId,
      action,
      error: errMessage(error),
    });
  }
}

async function sweepGuild(guild: Guild, deps: ActiveMemberDeps): Promise<GuildSweepResult> {
  const { logger } = deps;
  const plan = await planActiveMemberGuild(guild, deps.repos, deps, new Date());
  if (plan.skipReason || !plan.roleId) {
    const reason = plan.skipReason ?? "role-not-configured";
    logSweepSkip(deps, reason, { guild: guild.id, role: plan.roleId });
    return emptyGuildResult(guild.id, "skipped", reason);
  }

  const result: GuildSweepResult = {
    ...emptyGuildResult(guild.id, "ok"),
    candidates: plan.candidates.length,
    revokeDisabled: plan.revokeDisabled,
  };
  for (const candidate of plan.candidates) {
    await applyCandidate(guild, plan.roleId, candidate, result, deps);
  }
  logger.info("active member sweep done", {
    guild: guild.id,
    candidates: result.candidates,
    granted: result.granted,
    revoked: result.revoked,
    failed: result.failed,
    window: plan.window,
    revokeDisabled: plan.revokeDisabled,
  });
  return result;
}

function overallStatus(guilds: GuildSweepResult[]): SweepStatus {
  if (guilds.some((g) => g.status === "failed")) return "failed";
  if (guilds.length > 0 && guilds.every((g) => g.status === "skipped")) return "skipped";
  return "ok";
}

/** A sweep that did not get to any guild (client not ready, or crashed). */
export function emptySweep(
  status: SweepStatus,
  reason: SweepSkipReason | string,
  at: Date = new Date(),
): ActiveMemberSweepResult {
  const iso = at.toISOString();
  return { status, reason, startedAt: iso, finishedAt: iso, guilds: [] };
}

/** Run the active-member gate across every given guild (spec M4). */
export async function runActiveMemberSweep(
  guilds: Iterable<Guild>,
  deps: ActiveMemberDeps,
): Promise<ActiveMemberSweepResult> {
  const startedAt = new Date().toISOString();
  const results: GuildSweepResult[] = [];
  for (const guild of guilds) {
    try {
      results.push(await sweepGuild(guild, deps));
    } catch (error) {
      deps.logger.error("active member sweep failed", {
        guild: guild.id,
        error: errMessage(error),
      });
      results.push(emptyGuildResult(guild.id, "failed", errMessage(error)));
    }
  }
  return {
    status: overallStatus(results),
    startedAt,
    finishedAt: new Date().toISOString(),
    guilds: results,
  };
}
