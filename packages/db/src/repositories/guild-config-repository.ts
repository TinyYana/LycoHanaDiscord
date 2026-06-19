import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { guildConfig, type GuildConfig, type NewGuildConfig } from "../schema";

export type GuildConfigPatch = Partial<Omit<NewGuildConfig, "guildId" | "createdAt" | "updatedAt">>;

export interface GuildConfigRepository {
  /** Returns the config row, or undefined if the guild has none yet. */
  get(guildId: string): Promise<GuildConfig | undefined>;
  /** Returns the config, creating a defaults row on first access. */
  ensure(guildId: string): Promise<GuildConfig>;
  /** Upsert a partial config patch and return the resulting row. */
  update(guildId: string, patch: GuildConfigPatch): Promise<GuildConfig>;
}

export function createGuildConfigRepository(db: Db): GuildConfigRepository {
  async function get(guildId: string): Promise<GuildConfig | undefined> {
    const rows = await db
      .select()
      .from(guildConfig)
      .where(eq(guildConfig.guildId, guildId))
      .limit(1);
    return rows[0];
  }

  return {
    get,

    async ensure(guildId) {
      await db.insert(guildConfig).values({ guildId }).onConflictDoNothing();
      const row = await get(guildId);
      // The row exists after the insert/no-op above.
      return row as GuildConfig;
    },

    async update(guildId, patch) {
      const rows = await db
        .insert(guildConfig)
        .values({ guildId, ...patch })
        .onConflictDoUpdate({ target: guildConfig.guildId, set: patch })
        .returning();
      return rows[0];
    },
  };
}
