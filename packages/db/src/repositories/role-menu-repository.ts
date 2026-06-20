import { eq } from "drizzle-orm";
import type { Db } from "../client";
import {
  roleMenuOptions,
  roleMenus,
  type NewRoleMenu,
  type NewRoleMenuOption,
  type RoleMenu,
  type RoleMenuOption,
} from "../schema";

export interface RoleMenuWithOptions {
  menu: RoleMenu;
  options: RoleMenuOption[];
}

export interface CreateRoleMenuInput {
  menu: Omit<NewRoleMenu, "id" | "messageId" | "createdAt">;
  options: Array<Omit<NewRoleMenuOption, "id" | "menuId">>;
}

export interface RoleMenuRepository {
  create(input: CreateRoleMenuInput): Promise<RoleMenuWithOptions>;
  getById(id: number): Promise<RoleMenuWithOptions | undefined>;
  setMessageId(id: number, messageId: string): Promise<void>;
  /** Remove a menu and its options (used to roll back a failed creation). */
  delete(id: number): Promise<void>;
}

export function createRoleMenuRepository(db: Db): RoleMenuRepository {
  async function getById(id: number): Promise<RoleMenuWithOptions | undefined> {
    const [menu] = await db.select().from(roleMenus).where(eq(roleMenus.id, id)).limit(1);
    if (!menu) return undefined;
    const options = await db.select().from(roleMenuOptions).where(eq(roleMenuOptions.menuId, id));
    return { menu, options };
  }

  return {
    async create(input) {
      // Menu + options must land together: a failed second insert would
      // otherwise orphan the menu, so do both in one transaction.
      return db.transaction(async (tx) => {
        const [menu] = await tx.insert(roleMenus).values(input.menu).returning();
        if (!menu) throw new Error("failed to create role menu");
        if (input.options.length > 0) {
          await tx
            .insert(roleMenuOptions)
            .values(input.options.map((option) => ({ ...option, menuId: menu.id })));
        }
        const options = await tx
          .select()
          .from(roleMenuOptions)
          .where(eq(roleMenuOptions.menuId, menu.id));
        return { menu, options };
      });
    },

    getById,

    async setMessageId(id, messageId) {
      await db.update(roleMenus).set({ messageId }).where(eq(roleMenus.id, id));
    },

    async delete(id) {
      await db.transaction(async (tx) => {
        await tx.delete(roleMenuOptions).where(eq(roleMenuOptions.menuId, id));
        await tx.delete(roleMenus).where(eq(roleMenus.id, id));
      });
    },
  };
}
