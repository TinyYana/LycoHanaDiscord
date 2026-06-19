import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Moderation + system action log (spec §5.6). `moderatorId` is null for
 * system actions; `action` is free text (e.g. "honeypot_timeout",
 * "message_delete").
 */
export const moderationLogs = sqliteTable("moderation_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guildId: text("guild_id").notNull(),
  action: text("action").notNull(),
  targetUserId: text("target_user_id"),
  moderatorId: text("moderator_id"),
  reason: text("reason"),
  messageRef: text("message_ref"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type ModerationLog = typeof moderationLogs.$inferSelect;
export type NewModerationLog = typeof moderationLogs.$inferInsert;
