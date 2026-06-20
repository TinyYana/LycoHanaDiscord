import type { ActivityLimits } from "@lycohana/domain";
import type { Env } from "./env";

/** Resolved tunable runtime config, assembled once from the environment. */
export interface RuntimeConfig {
  timeZone: string;
  activeMemberWindowDays: number;
  activeMemberCron: string;
  embedDraftTtlMs: number;
  honeypotTimeoutSeconds: number;
  dynamicVoiceEmptyGraceMs: number;
  limits: ActivityLimits;
}

export function buildRuntimeConfig(env: Env): RuntimeConfig {
  return {
    timeZone: env.ACTIVITY_TIME_ZONE,
    activeMemberWindowDays: env.ACTIVE_MEMBER_WINDOW_DAYS,
    activeMemberCron: env.ACTIVE_MEMBER_CRON,
    embedDraftTtlMs: env.EMBED_DRAFT_TTL_MINUTES * 60_000,
    honeypotTimeoutSeconds: env.HONEYPOT_TIMEOUT_SECONDS,
    dynamicVoiceEmptyGraceMs: env.DYNAMIC_VOICE_EMPTY_GRACE_SECONDS * 1000,
    limits: {
      chatCooldownMs: env.ACTIVITY_CHAT_COOLDOWN_MS,
      voiceDailyCapSeconds: env.ACTIVITY_VOICE_DAILY_CAP_SECONDS,
      interactionDailyCap: env.ACTIVITY_INTERACTION_DAILY_CAP,
      imageDailyCap: env.ACTIVITY_IMAGE_DAILY_CAP,
      musicDailyCap: env.ACTIVITY_MUSIC_DAILY_CAP,
    },
  };
}
