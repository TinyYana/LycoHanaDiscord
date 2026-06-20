import { type Guild, type GuildMember, PermissionFlagsBits, type Role } from "discord.js";
import {
  type ActiveMemberAction,
  computeActivityScore,
  dateKey,
  decideActiveMember,
  rollingWindowStart,
} from "@lycohana/domain";
import type { GuildConfig, Repositories } from "@lycohana/db";
import type { Logger } from "../logger";
import { errMessage } from "../errors";

export interface ActiveMemberDeps {
  repos: Repositories;
  logger: Logger;
  windowDays: number;
  timeZone: string;
}

function hasExemptRole(member: GuildMember, exemptRoleIds: string[]): boolean {
  return exemptRoleIds.some((id) => member.roles.cache.has(id));
}

/** True if the bot can actually assign/remove this role; logs why if not. */
function botCanManageRole(guild: Guild, role: Role, logger: Logger): boolean {
  const me = guild.members.me;
  if (!me) return false;
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    logger.error("active member: missing ManageRoles", { guild: guild.id });
    return false;
  }
  if (role.managed) {
    logger.error("active member: role is integration-managed, cannot assign", {
      guild: guild.id,
      role: role.id,
    });
    return false;
  }
  if (me.roles.highest.comparePositionTo(role) <= 0) {
    logger.error("active member: role is not below the bot's highest role", {
      guild: guild.id,
      role: role.id,
    });
    return false;
  }
  return true;
}

interface SweepSettings {
  config: GuildConfig;
  role: Role;
  high: number | null;
  low: number | null;
}

interface SweepCounts {
  granted: number;
  revoked: number;
  failed: number;
}

async function sweepGuild(guild: Guild, deps: ActiveMemberDeps): Promise<void> {
  const { repos, logger, windowDays, timeZone } = deps;
  const settings = await resolveSweepSettings(guild, deps);
  if (!settings) return;

  const now = new Date();
  const from = rollingWindowStart(now, windowDays, timeZone);
  const to = dateKey(now, timeZone);
  const totals = await repos.activity.aggregateByUserBetween(guild.id, from, to);
  const scoreByUser = new Map(
    totals.map((t) => [t.userId, computeActivityScore(t.counts, settings.config.activityWeights)]),
  );

  // Need member objects (current roles) for everyone scored or already holding
  // the role — fetch the guild's members once, then work from cache.
  await guild.members.fetch();
  const candidates = new Set<string>([...scoreByUser.keys(), ...settings.role.members.keys()]);
  const counts: SweepCounts = { granted: 0, revoked: 0, failed: 0 };
  for (const userId of candidates) {
    await reconcileCandidate(guild, userId, scoreByUser.get(userId) ?? 0, settings, counts, logger);
  }

  logger.info("active member sweep done", {
    guild: guild.id,
    candidates: candidates.size,
    ...counts,
  });
}

async function resolveSweepSettings(
  guild: Guild,
  deps: ActiveMemberDeps,
): Promise<SweepSettings | undefined> {
  const config = await deps.repos.guildConfig.get(guild.id);
  if (!config?.activeMemberRoleId) return undefined;
  const high = config.activityThresholdHigh;
  const low = config.activityThresholdLow;
  if (high == null && low == null) return undefined;

  const role =
    guild.roles.cache.get(config.activeMemberRoleId) ??
    (await guild.roles.fetch(config.activeMemberRoleId).catch(() => null));
  if (!role) {
    deps.logger.error("active member: role not found", {
      guild: guild.id,
      role: config.activeMemberRoleId,
    });
    return undefined;
  }
  if (!botCanManageRole(guild, role, deps.logger)) return undefined;
  return { config, role, high, low };
}

async function reconcileCandidate(
  guild: Guild,
  userId: string,
  score: number,
  settings: SweepSettings,
  counts: SweepCounts,
  logger: Logger,
): Promise<void> {
  const member = guild.members.cache.get(userId);
  if (!member || member.user.bot || hasExemptRole(member, settings.config.exemptRoleIds)) return;

  const action = decideActiveMember({
    score,
    high: settings.high,
    low: settings.low,
    hasRole: member.roles.cache.has(settings.role.id),
  });
  if (action === "none") return;
  await changeActiveRole(guild, member, settings.role, action, score, counts, logger);
}

async function changeActiveRole(
  guild: Guild,
  member: GuildMember,
  role: Role,
  action: Exclude<ActiveMemberAction, "none">,
  score: number,
  counts: SweepCounts,
  logger: Logger,
): Promise<void> {
  try {
    if (action === "grant") await member.roles.add(role, "active-member gate");
    else await member.roles.remove(role, "active-member gate");
    counts[action === "grant" ? "granted" : "revoked"] += 1;
    logger.info(`active member ${action === "grant" ? "granted" : "revoked"}`, {
      guild: guild.id,
      user: member.id,
      score,
    });
  } catch (error) {
    counts.failed += 1;
    logger.error("active member: role change failed", {
      guild: guild.id,
      user: member.id,
      action,
      error: errMessage(error),
    });
  }
}

/** Run the active-member gate across every guild the bot is in (spec M4). */
export async function runActiveMemberSweep(
  guilds: Iterable<Guild>,
  deps: ActiveMemberDeps,
): Promise<void> {
  for (const guild of guilds) {
    try {
      await sweepGuild(guild, deps);
    } catch (error) {
      deps.logger.error("active member sweep failed", {
        guild: guild.id,
        error: errMessage(error),
      });
    }
  }
}
