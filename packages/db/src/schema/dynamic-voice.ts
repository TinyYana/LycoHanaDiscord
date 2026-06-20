import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Bot-created voice channels that remain eligible for automatic cleanup. */
export const dynamicVoiceChannels = pgTable("dynamic_voice_channels", {
  channelId: text("channel_id").primaryKey(),
  guildId: text("guild_id").notNull(),
  ownerId: text("owner_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type DynamicVoiceChannel = typeof dynamicVoiceChannels.$inferSelect;
export type NewDynamicVoiceChannel = typeof dynamicVoiceChannels.$inferInsert;
