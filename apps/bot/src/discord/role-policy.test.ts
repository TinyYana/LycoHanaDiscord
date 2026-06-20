import { PermissionFlagsBits, PermissionsBitField } from "discord.js";
import { describe, expect, it } from "vitest";
import { sensitiveRolePermissionNames, sensitiveRoleWarning } from "./role-policy";

describe("sensitiveRolePermissionNames", () => {
  it("flags a role with Administrator (raw bitfield string)", () => {
    const names = sensitiveRolePermissionNames(PermissionFlagsBits.Administrator.toString());
    expect(names).toHaveLength(1);
    expect(names[0]).toContain("Administrator");
  });

  it("flags each sensitive permission a PermissionsBitField carries", () => {
    const perms = new PermissionsBitField([
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.BanMembers,
    ]);
    const names = sensitiveRolePermissionNames(perms);
    expect(names.some((n) => n.includes("Manage Roles"))).toBe(true);
    expect(names.some((n) => n.includes("Ban Members"))).toBe(true);
    expect(names).toHaveLength(2);
  });

  it("returns nothing for a harmless role", () => {
    const perms = new PermissionsBitField([
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.AddReactions,
    ]);
    expect(sensitiveRolePermissionNames(perms)).toEqual([]);
    expect(sensitiveRolePermissionNames("0")).toEqual([]);
  });
});

describe("sensitiveRoleWarning", () => {
  it("returns a warning string only when sensitive permissions are present", () => {
    expect(sensitiveRoleWarning("0")).toBeUndefined();
    const warning = sensitiveRoleWarning(PermissionFlagsBits.Administrator.toString());
    expect(warning).toContain("⚠️");
    expect(warning).toContain("Administrator");
  });
});
