import {
  type ButtonInteraction,
  MessageFlags,
  PermissionFlagsBits,
  type Interaction,
  type Role,
} from "discord.js";
import type { RoleMenuOption, RoleMenuWithOptions } from "@lycohana/db";
import type { CommandContext } from "../commands/types";
import { parseRoleMenuCustomId } from "./custom-id";

type CachedButtonInteraction = ButtonInteraction<"cached">;

interface RoleMenuSelection {
  result: RoleMenuWithOptions;
  option: RoleMenuOption;
}

export async function handleRoleMenuInteraction(
  interaction: Interaction,
  ctx: CommandContext,
): Promise<boolean> {
  if (!interaction.isButton()) return false;
  const parsed = parseRoleMenuCustomId(interaction.customId);
  if (!parsed) return false;
  await toggleRole(interaction, ctx, parsed.menuId, parsed.optionId);
  return true;
}

async function toggleRole(
  interaction: ButtonInteraction,
  ctx: CommandContext,
  menuId: number,
  optionId: number,
): Promise<void> {
  if (!interaction.inCachedGuild()) {
    await reply(interaction, "請在伺服器內使用。");
    return;
  }

  const selection = await loadSelection(interaction, ctx, menuId, optionId);
  if (!selection) return;

  const availability = availabilityMessage(selection.result, Date.now());
  if (availability) {
    await reply(interaction, availability);
    return;
  }

  const role = await resolveManageableRole(interaction, ctx, menuId, selection.option.roleId);
  if (!role) return;
  await applyRoleToggle(interaction, ctx, menuId, role);
}

async function loadSelection(
  interaction: CachedButtonInteraction,
  ctx: CommandContext,
  menuId: number,
  optionId: number,
): Promise<RoleMenuSelection | undefined> {
  const result = await ctx.repos.roleMenu.getById(menuId);
  const option = result?.options.find((item) => item.id === optionId);
  if (result && option && result.menu.guildId === interaction.guildId) return { result, option };
  await reply(interaction, "這個身分組選單不存在或已失效。");
  return undefined;
}

function availabilityMessage(result: RoleMenuWithOptions, now: number): string | undefined {
  if (result.menu.availableFrom && now < result.menu.availableFrom.getTime()) {
    return "這個身分組選單尚未開始。";
  }
  if (result.menu.availableUntil && now > result.menu.availableUntil.getTime()) {
    return "這個身分組選單已經結束。";
  }
  return undefined;
}

async function resolveManageableRole(
  interaction: CachedButtonInteraction,
  ctx: CommandContext,
  menuId: number,
  roleId: string,
): Promise<Role | undefined> {
  const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
  if (!role) {
    await reply(interaction, "找不到這個身分組，請通知管理員。");
    return undefined;
  }
  if (botCanManageRole(interaction, role)) return role;

  ctx.logger.error("role menu: role is not manageable", {
    guild: interaction.guildId,
    menuId,
    role: role.id,
  });
  await reply(interaction, "我目前無法管理這個身分組，請管理員檢查權限與身分組順序。");
  return undefined;
}

function botCanManageRole(interaction: CachedButtonInteraction, role: Role): boolean {
  const me = interaction.guild.members.me;
  return Boolean(
    me?.permissions.has(PermissionFlagsBits.ManageRoles) &&
    !role.managed &&
    me.roles.highest.comparePositionTo(role) > 0,
  );
}

async function applyRoleToggle(
  interaction: CachedButtonInteraction,
  ctx: CommandContext,
  menuId: number,
  role: Role,
): Promise<void> {
  const remove = interaction.member.roles.cache.has(role.id);
  if (remove) await interaction.member.roles.remove(role, `role menu ${menuId}`);
  else await interaction.member.roles.add(role, `role menu ${menuId}`);

  ctx.logger.info("role menu toggled", {
    guild: interaction.guildId,
    user: interaction.user.id,
    menuId,
    role: role.id,
    action: remove ? "remove" : "add",
  });
  await reply(interaction, remove ? `已移除 <@&${role.id}>。` : `已取得 <@&${role.id}>。`);
}

async function reply(interaction: ButtonInteraction, content: string): Promise<void> {
  await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}
