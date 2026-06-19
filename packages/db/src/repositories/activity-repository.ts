import { and, eq, sql } from "drizzle-orm";
import type { ActivityCounts } from "@lycohana/domain";
import type { Db } from "../client";
import { activityDaily, type ActivityDaily } from "../schema";

/** Per-call deltas to add to a member's daily counts. */
export type ActivityDelta = Partial<ActivityCounts>;

export interface ActivityRepository {
  /** The member's row for a single calendar day, if any. */
  getDay(guildId: string, userId: string, date: string): Promise<ActivityDaily | undefined>;
  /** Atomically add `delta` to the member's counts for `date` (YYYY-MM-DD). */
  increment(guildId: string, userId: string, date: string, delta: ActivityDelta): Promise<void>;
}

export function createActivityRepository(db: Db): ActivityRepository {
  return {
    async getDay(guildId, userId, date) {
      const rows = await db
        .select()
        .from(activityDaily)
        .where(
          and(
            eq(activityDaily.guildId, guildId),
            eq(activityDaily.userId, userId),
            eq(activityDaily.date, date),
          ),
        )
        .limit(1);
      return rows[0];
    },

    async increment(guildId, userId, date, delta) {
      const values = {
        guildId,
        userId,
        date,
        chatCount: delta.chatCount ?? 0,
        voiceSeconds: delta.voiceSeconds ?? 0,
        imageCount: delta.imageCount ?? 0,
        musicCount: delta.musicCount ?? 0,
        interactionCount: delta.interactionCount ?? 0,
      };

      await db
        .insert(activityDaily)
        .values(values)
        .onConflictDoUpdate({
          target: [activityDaily.guildId, activityDaily.userId, activityDaily.date],
          set: {
            chatCount: sql`${activityDaily.chatCount} + ${values.chatCount}`,
            voiceSeconds: sql`${activityDaily.voiceSeconds} + ${values.voiceSeconds}`,
            imageCount: sql`${activityDaily.imageCount} + ${values.imageCount}`,
            musicCount: sql`${activityDaily.musicCount} + ${values.musicCount}`,
            interactionCount: sql`${activityDaily.interactionCount} + ${values.interactionCount}`,
          },
        });
    },
  };
}
