import type { Db } from "../client";
import { moderationLogs, type ModerationLog, type NewModerationLog } from "../schema";

/** What the caller supplies; `id`/`createdAt` are filled in by the database. */
export type ModerationLogEntry = Omit<NewModerationLog, "id" | "createdAt">;

export interface ModerationLogRepository {
  /** Persist one moderation/system action and return the stored row. */
  record(entry: ModerationLogEntry): Promise<ModerationLog>;
}

export function createModerationLogRepository(db: Db): ModerationLogRepository {
  return {
    async record(entry) {
      const [row] = await db.insert(moderationLogs).values(entry).returning();
      if (!row) throw new Error("failed to record moderation log");
      return row;
    },
  };
}
