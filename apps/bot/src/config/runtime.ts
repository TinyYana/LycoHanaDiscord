import type { ActivityLimits } from "@lycohana/domain";
import type { Env } from "./env";

/** Resolved tunable runtime config, assembled once from the environment. */
export interface RuntimeConfig {
  timeZone: string;
  activeMemberWindowDays: number;
  limits: ActivityLimits;
}

export function buildRuntimeConfig(env: Env): RuntimeConfig {
  return {
    timeZone: env.ACTIVITY_TIME_ZONE,
    activeMemberWindowDays: env.ACTIVE_MEMBER_WINDOW_DAYS,
    limits: {
      chatCooldownMs: env.ACTIVITY_CHAT_COOLDOWN_MS,
      voiceDailyCapSeconds: env.ACTIVITY_VOICE_DAILY_CAP_SECONDS,
      interactionDailyCap: env.ACTIVITY_INTERACTION_DAILY_CAP,
    },
  };
}
