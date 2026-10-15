import path from "node:path";
import type { ActivityLimits } from "@lycohana/domain";
import type { Env } from "./env";

/** Monorepo root; this file is apps/bot/(src|dist)/config/runtime.(ts|js). */
export const REPO_ROOT = path.resolve(__dirname, "../../../..");

/** Resolved tunable runtime config, assembled once from the environment. */
export interface RuntimeConfig {
  timeZone: string;
  activeMemberWindowDays: number;
  activeMemberCron: string;
  embedDraftTtlMs: number;
  honeypotTimeoutSeconds: number;
  dynamicVoiceEmptyGraceMs: number;
  limits: ActivityLimits;
  /** Absolute paths (env values are repo-root relative unless absolute). */
  messagesFile: string;
  commandsHashFile: string;
  shutdownTimeoutMs: number;
  adminPanel: { enabled: boolean; port: number };
}

export function buildRuntimeConfig(env: Env): RuntimeConfig {
  return {
    timeZone: env.ACTIVITY_TIME_ZONE,
    activeMemberWindowDays: env.ACTIVE_MEMBER_WINDOW_DAYS,
    activeMemberCron: env.ACTIVE_MEMBER_CRON,
    embedDraftTtlMs: env.EMBED_DRAFT_TTL_MINUTES * 60_000,
    honeypotTimeoutSeconds: env.HONEYPOT_TIMEOUT_SECONDS,
    dynamicVoiceEmptyGraceMs: env.DYNAMIC_VOICE_EMPTY_GRACE_SECONDS * 1000,
    messagesFile: path.resolve(REPO_ROOT, env.MESSAGES_FILE),
    commandsHashFile: path.resolve(REPO_ROOT, env.COMMANDS_HASH_FILE),
    shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
    adminPanel: { enabled: env.ADMIN_PANEL_ENABLED === "true", port: env.ADMIN_PANEL_PORT },
    limits: {
      chatCooldownMs: env.ACTIVITY_CHAT_COOLDOWN_MS,
      voiceDailyCapSeconds: env.ACTIVITY_VOICE_DAILY_CAP_SECONDS,
      interactionDailyCap: env.ACTIVITY_INTERACTION_DAILY_CAP,
      imageDailyCap: env.ACTIVITY_IMAGE_DAILY_CAP,
      musicDailyCap: env.ACTIVITY_MUSIC_DAILY_CAP,
    },
  };
}
