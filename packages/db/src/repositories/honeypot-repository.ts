import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { honeypotChannels, type HoneypotChannel, type NewHoneypotChannel } from "../schema";

/** Caller-supplied fields; `id`/`createdAt` are filled in by the database. */
export type HoneypotChannelInput = Omit<NewHoneypotChannel, "id" | "createdAt">;

export interface HoneypotRepository {
  /** Add or replace the honeypot config for a channel (channel_id is unique). */
  upsert(input: HoneypotChannelInput): Promise<HoneypotChannel>;
  /** Remove a channel's honeypot config; returns true if a row was deleted. */
  remove(guildId: string, channelId: string): Promise<boolean>;
  /** All honeypot channels configured in a guild. */
  list(guildId: string): Promise<HoneypotChannel[]>;
  /** Look up a single channel's honeypot config, if any. */
  getByChannel(channelId: string): Promise<HoneypotChannel | undefined>;
}

export function createHoneypotRepository(db: Db): HoneypotRepository {
  return {
    async upsert(input) {
      const [row] = await db
        .insert(honeypotChannels)
        .values(input)
        .onConflictDoUpdate({
          target: honeypotChannels.channelId,
          set: { action: input.action, timeoutSeconds: input.timeoutSeconds ?? null },
        })
        .returning();
      if (!row) throw new Error("failed to upsert honeypot channel");
      return row;
    },

    async remove(guildId, channelId) {
      const deleted = await db
        .delete(honeypotChannels)
        .where(
          and(eq(honeypotChannels.guildId, guildId), eq(honeypotChannels.channelId, channelId)),
        )
        .returning({ id: honeypotChannels.id });
      return deleted.length > 0;
    },

    async list(guildId) {
      return db.select().from(honeypotChannels).where(eq(honeypotChannels.guildId, guildId));
    },

    async getByChannel(channelId) {
      const rows = await db
        .select()
        .from(honeypotChannels)
        .where(eq(honeypotChannels.channelId, channelId))
        .limit(1);
      return rows[0];
    },
  };
}
