import type { Client } from "discord.js";
import type { ActiveMemberSweepResult } from "../active-member";

export interface SweepTotals {
  granted: number;
  revoked: number;
  failed: number;
}

export interface RuntimeStatusSnapshot {
  startedAt: string;
  discord: {
    ready: boolean;
    readyAt: string | null;
    /** WebSocket heartbeat latency; null before the first heartbeat. */
    pingMs: number | null;
    guildCount: number;
  };
  sweep: {
    last: ActiveMemberSweepResult | null;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    /** Accumulated over this process's lifetime. */
    totals: SweepTotals;
  };
}

/** In-process runtime status shared by PM2 metrics and the admin panel. */
export interface RuntimeStatus {
  recordSweep(result: ActiveMemberSweepResult): void;
  snapshot(): RuntimeStatusSnapshot;
}

/** Discord fields are read live from the client at snapshot time. */
export function createRuntimeStatus(discord: Client, startedAt: Date = new Date()): RuntimeStatus {
  let last: ActiveMemberSweepResult | null = null;
  let lastSuccessAt: string | null = null;
  let lastFailureAt: string | null = null;
  const totals: SweepTotals = { granted: 0, revoked: 0, failed: 0 };

  return {
    recordSweep(result) {
      last = result;
      if (result.status === "ok") lastSuccessAt = result.finishedAt;
      if (result.status === "failed") lastFailureAt = result.finishedAt;
      for (const guild of result.guilds) {
        totals.granted += guild.granted;
        totals.revoked += guild.revoked;
        totals.failed += guild.failed;
      }
    },

    snapshot() {
      const ready = discord.isReady();
      const ping = discord.ws.ping;
      return {
        startedAt: startedAt.toISOString(),
        discord: {
          ready,
          readyAt: discord.readyAt?.toISOString() ?? null,
          pingMs: ready && ping >= 0 ? ping : null,
          guildCount: discord.guilds.cache.size,
        },
        sweep: { last, lastSuccessAt, lastFailureAt, totals: { ...totals } },
      };
    },
  };
}
