import { z } from "zod";
import {
  ACTIVE_MEMBER_WINDOW_DAYS,
  ACTIVITY_TIME_ZONE,
  DEFAULT_ACTIVITY_LIMITS,
} from "@lycohana/domain";

/**
 * Environment schema. All secrets and tunable runtime config flow through
 * here so nothing tunable is hardcoded (spec §1.6, §8). Domain constants
 * supply the defaults; env vars override them without a code change.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Discord
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
  DISCORD_GUILD_ID: z.string().optional(),

  // Database (SQLite file path — dev substitute for PostgreSQL)
  DATABASE_URL: z.string().min(1).default("./data/lycohana.db"),

  // Runtime
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Activity tunables (spec §8). Defaults come from @lycohana/domain.
  ACTIVITY_TIME_ZONE: z.string().min(1).default(ACTIVITY_TIME_ZONE),
  ACTIVITY_CHAT_COOLDOWN_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(DEFAULT_ACTIVITY_LIMITS.chatCooldownMs),
  ACTIVITY_VOICE_DAILY_CAP_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_ACTIVITY_LIMITS.voiceDailyCapSeconds),
  ACTIVITY_INTERACTION_DAILY_CAP: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_ACTIVITY_LIMITS.interactionDailyCap),
  ACTIVE_MEMBER_WINDOW_DAYS: z.coerce.number().int().positive().default(ACTIVE_MEMBER_WINDOW_DAYS),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate and return the typed environment. Throws with a readable list of
 * problems if anything required is missing or malformed.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}
