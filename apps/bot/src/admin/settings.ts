import type { Guild } from "discord.js";
import {
  ACTIVE_MEMBER_SETTING_FIELDS,
  type ActiveMemberSettingsIssue,
  type ActivityWeights,
  DEFAULT_ACTIVITY_WEIGHTS,
  validateActiveMemberSettings,
} from "@lycohana/domain";
import type { GuildConfig } from "@lycohana/db";
import { roleManageProblem, settingsIssueText, skipReasonText } from "../active-member";
import { sensitiveRoleWarning } from "../discord/role-policy";
import { errMessage } from "../errors";
import type { Messages } from "../messages";
import {
  AdminError,
  type AdminDeps,
  type AdminFieldError,
  type AdminRequest,
  type AdminResult,
  okJson,
  requireGuild,
} from "./types";

/** The active-member settings the panel edits (one guild). */
interface PanelSettings {
  activeMemberRoleId: string | null;
  high: number | null;
  low: number | null;
  weights: ActivityWeights;
  exemptRoleIds: string[];
}

/** Untrusted values from the request body, before validation. */
type SettingsDraft = { [K in keyof PanelSettings]: unknown };

const WEIGHT_KEYS = ACTIVE_MEMBER_SETTING_FIELDS.filter((f) => f.group === "weights").map(
  (f) => f.key as keyof ActivityWeights,
);

const UNSET_SETTINGS: PanelSettings = {
  activeMemberRoleId: null,
  high: null,
  low: null,
  weights: DEFAULT_ACTIVITY_WEIGHTS,
  exemptRoleIds: [],
};

/** A guild without a config row shows the defaults a new row would get. */
function settingsOf(cfg: GuildConfig | undefined): PanelSettings {
  if (!cfg) return { ...UNSET_SETTINGS, weights: { ...DEFAULT_ACTIVITY_WEIGHTS } };
  return {
    activeMemberRoleId: cfg.activeMemberRoleId,
    high: cfg.activityThresholdHigh,
    low: cfg.activityThresholdLow,
    weights: { ...DEFAULT_ACTIVITY_WEIGHTS, ...cfg.activityWeights },
    exemptRoleIds: cfg.exemptRoleIds,
  };
}

/** Assignable roles, highest first (@everyone excluded). */
function roleOptions(guild: Guild) {
  return [...guild.roles.cache.values()]
    .filter((role) => role.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map((role) => ({ id: role.id, name: role.name, managed: role.managed }));
}

/** Reuses the sweep's role checks and the role-policy sensitive-permission warning. */
function roleWarnings(guild: Guild, roleId: string | null, messages: Messages): string[] {
  if (!roleId) return [];
  const role = guild.roles.cache.get(roleId);
  if (!role) return [skipReasonText(messages, "role-not-found")];
  const problem = roleManageProblem(guild, role);
  return [
    problem && skipReasonText(messages, problem),
    sensitiveRoleWarning(role.permissions),
  ].filter((line): line is string => Boolean(line));
}

const issueTexts = (messages: Messages, issues: ActiveMemberSettingsIssue[]) =>
  issues.map((issue) => settingsIssueText(messages, issue));

function configView(guild: Guild, cfg: GuildConfig | undefined, messages: Messages) {
  const settings = settingsOf(cfg);
  const { warnings } = validateActiveMemberSettings(settings);
  return {
    settings,
    roles: roleOptions(guild),
    warnings: [
      ...issueTexts(messages, warnings),
      ...roleWarnings(guild, settings.activeMemberRoleId, messages),
    ],
  };
}

async function loadConfig(
  deps: AdminDeps,
  guildId: string,
  errorKey = "admin.error.load-failed",
): Promise<GuildConfig | undefined> {
  try {
    return await deps.repos.guildConfig.get(guildId);
  } catch (error) {
    deps.logger.error("admin: guild config load failed", {
      guild: guildId,
      error: errMessage(error),
    });
    throw new AdminError(500, errorKey);
  }
}

export async function getConfig(deps: AdminDeps, req: AdminRequest): Promise<AdminResult> {
  const guild = requireGuild(deps, req.params.guildId);
  return okJson(configView(guild, await loadConfig(deps, guild.id), deps.messages));
}

/** The body's value for `key` when present (even null), else the fallback. */
function pick(body: Record<string, unknown>, key: string, fallback: unknown): unknown {
  return Object.hasOwn(body, key) ? body[key] : fallback;
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

/** Body fields override the stored settings; absent fields keep their stored value. */
function draftFrom(body: unknown, current: PanelSettings): SettingsDraft {
  const b = asRecord(body);
  if (!b) throw new AdminError(400, "admin.error.bad-body");
  const weights = asRecord(b.weights) ?? {};
  return {
    activeMemberRoleId: pick(b, "activeMemberRoleId", current.activeMemberRoleId),
    high: pick(b, "high", current.high),
    low: pick(b, "low", current.low),
    // Only declared weight keys; anything else in the body is ignored.
    weights: Object.fromEntries(
      WEIGHT_KEYS.map((key) => [key, pick(weights, key, current.weights[key])]),
    ),
    exemptRoleIds: pick(b, "exemptRoleIds", current.exemptRoleIds),
  };
}

const isGuildRole = (guild: Guild, id: unknown): boolean =>
  typeof id === "string" && id !== guild.id && guild.roles.cache.has(id);

function roleErrors(guild: Guild, draft: SettingsDraft, messages: Messages): AdminFieldError[] {
  const text = messages.t("admin.error.role-not-found");
  const errors: AdminFieldError[] = [];
  if (draft.activeMemberRoleId !== null && !isGuildRole(guild, draft.activeMemberRoleId)) {
    errors.push({ field: "activeMemberRoleId", text });
  }
  const exempt = draft.exemptRoleIds;
  if (!Array.isArray(exempt) || !exempt.every((id) => isGuildRole(guild, id))) {
    errors.push({ field: "exemptRoleIds", text });
  }
  return errors;
}

/** Shared domain validation plus role checks; throws 400 with per-field messages. */
function validateDraft(guild: Guild, draft: SettingsDraft, messages: Messages): PanelSettings {
  const validation = validateActiveMemberSettings({
    high: draft.high as number | null,
    low: draft.low as number | null,
    weights: draft.weights as Partial<ActivityWeights>,
  });
  const fieldErrors: AdminFieldError[] = [
    ...validation.errors.map((issue) => ({
      field: issue.field,
      text: settingsIssueText(messages, issue),
    })),
    ...roleErrors(guild, draft, messages),
  ];
  if (fieldErrors.length > 0) throw new AdminError(400, "admin.error.validation", fieldErrors);
  const settings = draft as PanelSettings;
  return { ...settings, exemptRoleIds: [...new Set(settings.exemptRoleIds)] };
}

/**
 * Validate → update → read back. The response carries the stored row as read
 * back from the database, so the page shows what the next sweep will use.
 */
export async function saveConfig(deps: AdminDeps, req: AdminRequest): Promise<AdminResult> {
  const { messages, logger } = deps;
  const guild = requireGuild(deps, req.params.guildId);
  const draft = draftFrom(req.body, settingsOf(await loadConfig(deps, guild.id)));
  const next = validateDraft(guild, draft, messages);
  try {
    await deps.repos.guildConfig.update(guild.id, {
      activeMemberRoleId: next.activeMemberRoleId,
      activityThresholdHigh: next.high,
      activityThresholdLow: next.low,
      activityWeights: next.weights,
      exemptRoleIds: next.exemptRoleIds,
    });
  } catch (error) {
    logger.error("admin: guild config save failed", { guild: guild.id, error: errMessage(error) });
    throw new AdminError(500, "admin.error.save-failed");
  }
  // Saved, but the page must not claim success without the stored values.
  const saved = await loadConfig(deps, guild.id, "admin.error.readback-failed");
  if (!saved) throw new AdminError(500, "admin.error.readback-failed");
  logger.info("admin: active-member settings saved", { guild: guild.id });
  return okJson({
    message: messages.t("admin.save.success"),
    ...configView(guild, saved, messages),
  });
}
