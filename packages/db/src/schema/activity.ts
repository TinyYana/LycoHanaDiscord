import { integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";

/**
 * One row per member per calendar day (spec §5.2). Raw events are not
 * stored; cooldown and voice sessions live in memory. Both the rolling-30d
 * role gate and the monthly personal view aggregate from here.
 */
export const activityDaily = pgTable(
  "activity_daily",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD (calendar day)

    chatCount: integer("chat_count").notNull().default(0),
    voiceSeconds: integer("voice_seconds").notNull().default(0),
    imageCount: integer("image_count").notNull().default(0),
    musicCount: integer("music_count").notNull().default(0),
    interactionCount: integer("interaction_count").notNull().default(0),

    ...timestamps(),
  },
  (t) => [primaryKey({ columns: [t.guildId, t.userId, t.date] })],
);

export type ActivityDaily = typeof activityDaily.$inferSelect;
export type NewActivityDaily = typeof activityDaily.$inferInsert;
