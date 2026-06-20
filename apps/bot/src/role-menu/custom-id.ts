const PREFIX = "role-menu";

export function roleMenuCustomId(menuId: number, optionId: number): string {
  return `${PREFIX}:${menuId}:${optionId}`;
}

export function parseRoleMenuCustomId(
  customId: string,
): { menuId: number; optionId: number } | undefined {
  const [prefix, menuRaw, optionRaw, extra] = customId.split(":");
  if (prefix !== PREFIX || extra != null) return undefined;
  const menuId = Number(menuRaw);
  const optionId = Number(optionRaw);
  if (!Number.isSafeInteger(menuId) || !Number.isSafeInteger(optionId)) return undefined;
  return { menuId, optionId };
}
