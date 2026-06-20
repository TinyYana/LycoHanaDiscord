import { PermissionFlagsBits, type PermissionsBitField } from "discord.js";

/**
 * Discord permissions that make a role risky to hand out automatically (the
 * active-member gate) or via self-service (role menus). Configuring such a role
 * is allowed but warned about, so an administrator notices before a cosmetic
 * role quietly grants real power. The list is fixed on purpose — a configurable
 * policy DSL would be more surface than this bot needs.
 */
const SENSITIVE_ROLE_PERMISSIONS: ReadonlyArray<readonly [string, bigint]> = [
  ["管理員 (Administrator)", PermissionFlagsBits.Administrator],
  ["管理伺服器 (Manage Guild)", PermissionFlagsBits.ManageGuild],
  ["管理身分組 (Manage Roles)", PermissionFlagsBits.ManageRoles],
  ["管理頻道 (Manage Channels)", PermissionFlagsBits.ManageChannels],
  ["管理 Webhook (Manage Webhooks)", PermissionFlagsBits.ManageWebhooks],
  ["封鎖成員 (Ban Members)", PermissionFlagsBits.BanMembers],
  ["踢出成員 (Kick Members)", PermissionFlagsBits.KickMembers],
  ["禁言成員 (Moderate Members)", PermissionFlagsBits.ModerateMembers],
];

/** A role's permission bits, whether it is a cached `Role` or a raw `APIRole`. */
type RolePermissions = PermissionsBitField | string;

function toBits(permissions: RolePermissions): bigint {
  return typeof permissions === "string" ? BigInt(permissions) : permissions.bitfield;
}

/** Sensitive permission names the role carries, in declaration order. */
export function sensitiveRolePermissionNames(permissions: RolePermissions): string[] {
  const bits = toBits(permissions);
  return SENSITIVE_ROLE_PERMISSIONS.filter(([, bit]) => (bits & bit) === bit).map(([name]) => name);
}

/**
 * A warning line if the role carries sensitive permissions, else `undefined`.
 * Callers append this to their reply; it never blocks the action.
 */
export function sensitiveRoleWarning(permissions: RolePermissions): string | undefined {
  const names = sensitiveRolePermissionNames(permissions);
  if (names.length === 0) return undefined;
  return `⚠️ 此身分組帶有敏感權限（${names.join("、")}），自動發放或讓成員自助取得會擴大這些權限的影響，請確認這是你要的。`;
}
