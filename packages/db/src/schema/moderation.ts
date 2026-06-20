import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Moderation + system action log (spec §5.6). `moderatorId` is null for
 * system actions; `action` is free text (e.g. "honeypot_timeout",
 * "message_delete").
 */
export const moderationLogs = pgTable("moderation_logs", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  action: text("action").notNull(),
  targetUserId: text("target_user_id"),
  moderatorId: text("moderator_id"),
  reason: text("reason"),
  messageRef: text("message_ref"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type ModerationLog = typeof moderationLogs.$inferSelect;
export type NewModerationLog = typeof moderationLogs.$inferInsert;
