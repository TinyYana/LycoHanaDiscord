import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { HONEYPOT_ACTIONS } from "@lycohana/domain";

/**
 * Honeypot decoy channel config (spec §5.7). One row per channel
 * (`channel_id` unique). `timeout` is the default action; `timeoutSeconds`
 * applies when the action is `timeout`.
 */
export const honeypotChannels = pgTable("honeypot_channels", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull().unique(),
  action: text("action", { enum: HONEYPOT_ACTIONS }).notNull().default("timeout"),
  timeoutSeconds: integer("timeout_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type HoneypotChannel = typeof honeypotChannels.$inferSelect;
export type NewHoneypotChannel = typeof honeypotChannels.$inferInsert;
