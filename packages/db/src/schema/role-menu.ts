import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/** Self-service button role menu (spec §5.3). */
export const roleMenus = pgTable("role_menus", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"), // null until the menu message is posted
  title: text("title").notNull(),
  availableFrom: timestamp("available_from", { withTimezone: true }),
  availableUntil: timestamp("available_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** One selectable role within a menu (spec §5.4). */
export const roleMenuOptions = pgTable("role_menu_options", {
  id: serial("id").primaryKey(),
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
