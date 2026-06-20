import { boolean, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { DEFAULT_ACTIVITY_WEIGHTS, type ActivityWeights } from "@lycohana/domain";
import { timestamps } from "./_shared";

/** Per-guild bot configuration (spec §5.1). */
export const guildConfig = pgTable("guild_config", {
  guildId: text("guild_id").primaryKey(),

  // Welcome / leave
  welcomeChannelId: text("welcome_channel_id"),
  welcomeEnabled: boolean("welcome_enabled").notNull().default(false),
  leaveLogChannelId: text("leave_log_channel_id"),

  // Moderation log
  logChannelId: text("log_channel_id"),

  // Dynamic voice channel entry point
  dynamicVoiceTriggerChannelId: text("dynamic_voice_trigger_channel_id"),

  // Active-member role + activity scoring
  activeMemberRoleId: text("active_member_role_id"),
  activityThresholdHigh: integer("activity_threshold_high"),
  activityThresholdLow: integer("activity_threshold_low"),
  activityWeights: jsonb("activity_weights")
    .$type<ActivityWeights>()
    .notNull()
    .$defaultFn(() => DEFAULT_ACTIVITY_WEIGHTS),
  exemptRoleIds: jsonb("exempt_role_ids")
    .$type<string[]>()
    .notNull()
    .$defaultFn(() => []),

  ...timestamps(),
});

export type GuildConfig = typeof guildConfig.$inferSelect;
export type NewGuildConfig = typeof guildConfig.$inferInsert;
