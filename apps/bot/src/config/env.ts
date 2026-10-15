import { z } from "zod";
import {
  ACTIVE_MEMBER_WINDOW_DAYS,
  ACTIVITY_TIME_ZONE,
  DEFAULT_ACTIVITY_LIMITS,
  DEFAULT_ACTIVE_MEMBER_CRON,
  DEFAULT_EMBED_DRAFT_TTL_MINUTES,
  DEFAULT_HONEYPOT_TIMEOUT_SECONDS,
} from "@lycohana/domain";

/** Default local admin panel port (override with ADMIN_PANEL_PORT). */
export const DEFAULT_ADMIN_PANEL_PORT = 2615;

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
  // Slash-command registration at startup: `auto` registers only when the
  // command definitions (or target) changed since the last successful push,
  // `always` registers every start, `off` never (use `pnpm commands:register`).
  COMMANDS_REGISTER_MODE: z.enum(["auto", "always", "off"]).default("auto"),
  // Where `auto` remembers the last registered definitions' hash (repo-root relative).
  COMMANDS_HASH_FILE: z.string().min(1).default(".runtime/commands.hash"),

  // Database (PostgreSQL connection string — Supabase)
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Runtime
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  // Operator-facing text (hot-reloaded on change; repo-root relative).
  MESSAGES_FILE: z.string().min(1).default("apps/bot/messages/zh-TW.json"),
  // Graceful-shutdown cap. Keep below PM2's kill_timeout (ecosystem.config.cjs).
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),

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
  ACTIVITY_IMAGE_DAILY_CAP: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_ACTIVITY_LIMITS.imageDailyCap),
  ACTIVITY_MUSIC_DAILY_CAP: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_ACTIVITY_LIMITS.musicDailyCap),
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
  // Grace window before an emptied dynamic voice channel is deleted, so a brief
  // disconnect/reconnect doesn't destroy the room. 0 = delete immediately.
  DYNAMIC_VOICE_EMPTY_GRACE_SECONDS: z.coerce.number().int().nonnegative().default(60),

  // Local admin panel. Always bound to 127.0.0.1 (not configurable); reach it
  // remotely only through your own SSH tunnel.
  ADMIN_PANEL_ENABLED: z.enum(["true", "false"]).default("true"),
  ADMIN_PANEL_PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_ADMIN_PANEL_PORT),
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
