import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { DEFAULT_ACTIVITY_WEIGHTS, type ActivityWeights } from "@lycohana/domain";
import { timestamps } from "./_shared";

/** Per-guild bot configuration (spec §5.1). */
export const guildConfig = sqliteTable("guild_config", {
  guildId: text("guild_id").primaryKey(),

  // Welcome / leave
  welcomeChannelId: text("welcome_channel_id"),
  welcomeEnabled: integer("welcome_enabled", { mode: "boolean" }).notNull().default(false),
  leaveLogChannelId: text("leave_log_channel_id"),

  // Moderation log
  logChannelId: text("log_channel_id"),

  // Active-member role + activity scoring
  activeMemberRoleId: text("active_member_role_id"),
  activityThresholdHigh: integer("activity_threshold_high"),
  activityThresholdLow: integer("activity_threshold_low"),
  activityWeights: text("activity_weights", { mode: "json" })
    .$type<ActivityWeights>()
    .notNull()
    .$defaultFn(() => DEFAULT_ACTIVITY_WEIGHTS),
  exemptRoleIds: text("exempt_role_ids", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .$defaultFn(() => []),

  ...timestamps(),
});

export type GuildConfig = typeof guildConfig.$inferSelect;
export type NewGuildConfig = typeof guildConfig.$inferInsert;
