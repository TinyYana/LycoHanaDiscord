import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { HONEYPOT_ACTIONS } from "@lycohana/domain";

/**
 * Honeypot decoy channel config (spec §5.7). One row per channel
 * (`channel_id` unique). `timeout` is the default action; `timeoutSeconds`
 * applies when the action is `timeout`.
 */
export const honeypotChannels = sqliteTable("honeypot_channels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull().unique(),
  action: text("action", { enum: HONEYPOT_ACTIONS }).notNull().default("timeout"),
  timeoutSeconds: integer("timeout_seconds"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type HoneypotChannel = typeof honeypotChannels.$inferSelect;
export type NewHoneypotChannel = typeof honeypotChannels.$inferInsert;
