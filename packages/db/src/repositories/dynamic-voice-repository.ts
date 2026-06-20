import { eq } from "drizzle-orm";
import type { Db } from "../client";
import {
  dynamicVoiceChannels,
  type DynamicVoiceChannel,
  type NewDynamicVoiceChannel,
} from "../schema";

export type DynamicVoiceChannelInput = Omit<NewDynamicVoiceChannel, "createdAt">;

export interface DynamicVoiceRepository {
  /** Persist a newly-created channel so cleanup survives bot restarts. */
  add(input: DynamicVoiceChannelInput): Promise<DynamicVoiceChannel>;
  /** Look up whether a Discord channel is managed by this feature. */
  get(channelId: string): Promise<DynamicVoiceChannel | undefined>;
  /** List every managed channel for startup reconciliation. */
  list(): Promise<DynamicVoiceChannel[]>;
  /** Forget a channel after it is deleted or found missing. */
  remove(channelId: string): Promise<boolean>;
}

export function createDynamicVoiceRepository(db: Db): DynamicVoiceRepository {
  return {
    async add(input) {
      const [row] = await db.insert(dynamicVoiceChannels).values(input).returning();
      if (!row) throw new Error("failed to persist dynamic voice channel");
      return row;
    },

    async get(channelId) {
      const rows = await db
        .select()
        .from(dynamicVoiceChannels)
        .where(eq(dynamicVoiceChannels.channelId, channelId))
        .limit(1);
      return rows[0];
    },

    async list() {
      return db.select().from(dynamicVoiceChannels);
    },

    async remove(channelId) {
      const deleted = await db
        .delete(dynamicVoiceChannels)
        .where(eq(dynamicVoiceChannels.channelId, channelId))
        .returning({ channelId: dynamicVoiceChannels.channelId });
      return deleted.length > 0;
    },
  };
}
