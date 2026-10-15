import { type Guild, type GuildMember, PermissionFlagsBits, type Role } from "discord.js";
import {
  type ActiveMemberDecisionReason,
  computeActivityScore,
  dateKey,
  explainActiveMember,
  type RevokeDisabledReason,
  revokeDisabledReason,
  rollingWindowStart,
} from "@lycohana/domain";
import type { GuildConfig, Repositories } from "@lycohana/db";

/** Only the repositories the planner reads. */
export type ActiveMemberPlanRepos = Pick<Repositories, "guildConfig" | "activity">;

/** Rolling-window settings (from runtime config). */
export interface ActiveMemberWindowOptions {
  windowDays: number;
  timeZone: string;
}

/**
 * Why a guild (or, for `client-not-ready`, the whole sweep) is not swept, with
 * the log level it deserves: missing configuration just means the feature is
 * off; anything else needs an operator. Texts live in the messages file.
 */
export const ACTIVE_MEMBER_SKIP_REASONS = {
  "role-not-configured": { level: "info", messageKey: "activeMember.skip.role-not-configured" },
  "thresholds-not-configured": {
    level: "info",
    messageKey: "activeMember.skip.thresholds-not-configured",
  },
  "role-not-found": { level: "error", messageKey: "activeMember.skip.role-not-found" },
  "bot-member-unavailable": {
    level: "error",
    messageKey: "activeMember.skip.bot-member-unavailable",
  },
  "missing-manage-roles": { level: "error", messageKey: "activeMember.skip.missing-manage-roles" },
  "role-managed": { level: "error", messageKey: "activeMember.skip.role-managed" },
  "role-not-below-bot": { level: "error", messageKey: "activeMember.skip.role-not-below-bot" },
  "client-not-ready": { level: "warn", messageKey: "activeMember.skip.client-not-ready" },
} as const satisfies Record<string, { level: "info" | "warn" | "error"; messageKey: string }>;

export type SweepSkipReason = keyof typeof ACTIVE_MEMBER_SKIP_REASONS;
/** Guild-level skip reasons (everything except the sweep-wide one). */
export type ActiveMemberSkipReason = Exclude<SweepSkipReason, "client-not-ready">;

/** Why a single candidate is left alone before any threshold check. */
export const ACTIVE_MEMBER_CANDIDATE_SKIP_REASONS = {
  "not-in-guild": { messageKey: "activeMember.reason.not-in-guild" },
  bot: { messageKey: "activeMember.reason.bot" },
  exempt: { messageKey: "activeMember.reason.exempt" },
} as const;

export type ActiveMemberCandidateSkipReason = keyof typeof ACTIVE_MEMBER_CANDIDATE_SKIP_REASONS;

export interface ActiveMemberCandidatePlan {
  userId: string;
  displayName?: string;
  score: number;
  hasRole: boolean;
  exempt: boolean;
  action: "grant" | "revoke" | "hold" | "skip";
  reason: ActiveMemberDecisionReason | ActiveMemberCandidateSkipReason;
}

export interface ActiveMemberGuildPlan {
  guildId: string;
  /** Set when the guild cannot be swept; `candidates` is then empty. */
  skipReason?: ActiveMemberSkipReason;
  roleId: string | null;
  high: number | null;
  low: number | null;
  /** Inclusive day keys (YYYY-MM-DD) of the scoring window. */
  window: { from: string; to: string };
  /** Set when no one can ever be revoked with the current low threshold. */
  revokeDisabled?: RevokeDisabledReason;
  candidates: ActiveMemberCandidatePlan[];
}

/** First reason the bot cannot assign/remove this role, if any. */
export function roleManageProblem(guild: Guild, role: Role): ActiveMemberSkipReason | undefined {
  const me = guild.members.me;
  if (!me) return "bot-member-unavailable";
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) return "missing-manage-roles";
  if (role.managed) return "role-managed";
  if (me.roles.highest.comparePositionTo(role) <= 0) return "role-not-below-bot";
  return undefined;
}

async function resolveRole(
  guild: Guild,
  config: GuildConfig,
): Promise<Role | ActiveMemberSkipReason> {
  if (!config.activeMemberRoleId) return "role-not-configured";
  if (config.activityThresholdHigh == null && config.activityThresholdLow == null) {
    return "thresholds-not-configured";
  }
  const roleId = config.activeMemberRoleId;
  const role = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
  if (!role) return "role-not-found";
  return roleManageProblem(guild, role) ?? role;
}

function hasExemptRole(member: GuildMember, exemptRoleIds: string[]): boolean {
  return exemptRoleIds.some((id) => member.roles.cache.has(id));
}

function planCandidate(
  member: GuildMember | undefined,
  userId: string,
  score: number,
  config: GuildConfig,
  roleId: string,
): ActiveMemberCandidatePlan {
  if (!member) {
    return { userId, score, hasRole: false, exempt: false, action: "skip", reason: "not-in-guild" };
  }
  const base = {
    userId,
    displayName: member.displayName,
    score,
    hasRole: member.roles.cache.has(roleId),
    exempt: hasExemptRole(member, config.exemptRoleIds),
  };
  if (member.user.bot) return { ...base, action: "skip", reason: "bot" };
  if (base.exempt) return { ...base, action: "skip", reason: "exempt" };
  const verdict = explainActiveMember({
    score,
    high: config.activityThresholdHigh,
    low: config.activityThresholdLow,
    hasRole: base.hasRole,
  });
  return { ...base, ...verdict };
}

/**
 * Work out what the active-member sweep would do in one guild, without
 * touching Discord roles. Fetches the guild's members (to see current roles),
 * scores everyone with activity in the window, and plans each candidate:
 * members scored in the window ∪ current role holders (who score 0 when they
 * have no activity in the window).
 */
export async function planActiveMemberGuild(
  guild: Guild,
  repos: ActiveMemberPlanRepos,
  options: ActiveMemberWindowOptions,
  now: Date,
): Promise<ActiveMemberGuildPlan> {
  const window = {
    from: rollingWindowStart(now, options.windowDays, options.timeZone),
    to: dateKey(now, options.timeZone),
  };
  const config = await repos.guildConfig.get(guild.id);
  if (!config) {
    return {
      guildId: guild.id,
      skipReason: "role-not-configured",
      roleId: null,
      high: null,
      low: null,
      window,
      candidates: [],
    };
  }
  const plan: ActiveMemberGuildPlan = {
    guildId: guild.id,
    roleId: config.activeMemberRoleId,
    high: config.activityThresholdHigh,
    low: config.activityThresholdLow,
    window,
    candidates: [],
  };
  const role = await resolveRole(guild, config);
  if (typeof role === "string") return { ...plan, skipReason: role };
  plan.revokeDisabled = revokeDisabledReason(plan.low);

  const totals = await repos.activity.aggregateByUserBetween(guild.id, window.from, window.to);
  const scoreByUser = new Map(
    totals.map((t) => [t.userId, computeActivityScore(t.counts, config.activityWeights)]),
  );
  // Need member objects (current roles) for everyone scored or already holding
  // the role — fetch the guild's members once, then work from cache.
  await guild.members.fetch();
  const candidates = new Set<string>([...scoreByUser.keys(), ...role.members.keys()]);
  plan.candidates = [...candidates].map((userId) =>
    planCandidate(
      guild.members.cache.get(userId),
      userId,
      scoreByUser.get(userId) ?? 0,
      config,
      role.id,
    ),
  );
  return plan;
}
