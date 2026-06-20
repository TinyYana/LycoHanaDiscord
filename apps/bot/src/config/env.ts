import { z } from "zod";
import {
  ACTIVE_MEMBER_WINDOW_DAYS,
  ACTIVITY_TIME_ZONE,
  DEFAULT_ACTIVITY_LIMITS,
  DEFAULT_ACTIVE_MEMBER_CRON,
  DEFAULT_EMBED_DRAFT_TTL_MINUTES,
  DEFAULT_HONEYPOT_TIMEOUT_SECONDS,
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

  // Database (PostgreSQL connection string — Supabase)
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

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
  // Cron expression for the daily active-member sweep (spec M4).
  ACTIVE_MEMBER_CRON: z.string().min(1).default(DEFAULT_ACTIVE_MEMBER_CRON),
  EMBED_DRAFT_TTL_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_EMBED_DRAFT_TTL_MINUTES),
  // Default honeypot timeout when a channel sets no per-channel duration (spec M8).
  HONEYPOT_TIMEOUT_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_HONEYPOT_TIMEOUT_SECONDS),
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
