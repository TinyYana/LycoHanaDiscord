import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Self-service button role menu (spec §5.3). */
export const roleMenus = sqliteTable("role_menus", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"), // null until the menu message is posted
  title: text("title").notNull(),
  availableFrom: integer("available_from", { mode: "timestamp" }),
  availableUntil: integer("available_until", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** One selectable role within a menu (spec §5.4). */
export const roleMenuOptions = sqliteTable("role_menu_options", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  menuId: integer("menu_id")
    .notNull()
    .references(() => roleMenus.id, { onDelete: "cascade" }),
  roleId: text("role_id").notNull(),
  label: text("label").notNull(),
  emoji: text("emoji"),
});

export type RoleMenu = typeof roleMenus.$inferSelect;
export type NewRoleMenu = typeof roleMenus.$inferInsert;
export type RoleMenuOption = typeof roleMenuOptions.$inferSelect;
export type NewRoleMenuOption = typeof roleMenuOptions.$inferInsert;
