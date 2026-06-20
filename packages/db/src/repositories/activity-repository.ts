import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { ActivityCounts } from "@lycohana/domain";
import type { Db } from "../client";
import { activityDaily, type ActivityDaily } from "../schema";

/** Per-call deltas to add to a member's daily counts. */
export type ActivityDelta = Partial<ActivityCounts>;

/** Summed counts for one member over a date range. */
export interface UserActivityTotals {
  userId: string;
  counts: ActivityCounts;
}

export interface ActivityRepository {
  /** The member's row for a single calendar day, if any. */
  getDay(guildId: string, userId: string, date: string): Promise<ActivityDaily | undefined>;
  /** Atomically add `delta` to the member's counts for `date` (YYYY-MM-DD). */
  increment(guildId: string, userId: string, date: string, delta: ActivityDelta): Promise<void>;
  /** All of a member's daily rows within [from, to] (inclusive). */
  listForUserBetween(
    guildId: string,
    userId: string,
    from: string,
    to: string,
  ): Promise<ActivityDaily[]>;
  /** Per-member summed counts within [from, to] (inclusive) for the guild. */
  aggregateByUserBetween(guildId: string, from: string, to: string): Promise<UserActivityTotals[]>;
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

    async listForUserBetween(guildId, userId, from, to) {
      return db
        .select()
        .from(activityDaily)
        .where(
          and(
            eq(activityDaily.guildId, guildId),
            eq(activityDaily.userId, userId),
            gte(activityDaily.date, from),
            lte(activityDaily.date, to),
          ),
        );
    },

    async aggregateByUserBetween(guildId, from, to) {
      const rows = await db
        .select({
          // Postgres returns sum() as a numeric string; cast to int so these
          // come back as JS numbers.
          userId: activityDaily.userId,
          chatCount: sql<number>`coalesce(sum(${activityDaily.chatCount}), 0)::int`,
          voiceSeconds: sql<number>`coalesce(sum(${activityDaily.voiceSeconds}), 0)::int`,
          imageCount: sql<number>`coalesce(sum(${activityDaily.imageCount}), 0)::int`,
          musicCount: sql<number>`coalesce(sum(${activityDaily.musicCount}), 0)::int`,
          interactionCount: sql<number>`coalesce(sum(${activityDaily.interactionCount}), 0)::int`,
        })
        .from(activityDaily)
        .where(
          and(
            eq(activityDaily.guildId, guildId),
            gte(activityDaily.date, from),
            lte(activityDaily.date, to),
          ),
        )
        .groupBy(activityDaily.userId);

      return rows.map((r) => ({
        userId: r.userId,
        counts: {
          chatCount: r.chatCount,
          voiceSeconds: r.voiceSeconds,
          imageCount: r.imageCount,
          musicCount: r.musicCount,
          interactionCount: r.interactionCount,
        },
      }));
    },
  };
}
