import type { Messages } from "../messages";
import type { RuntimeStatusSnapshot } from "./index";

/**
 * Runtime metrics, declared once: PM2 registers one tx2 metric per entry and
 * the admin panel can render the same list. Names, units and word values are
 * message keys.
 */
export interface RuntimeMetric {
  id: string;
  nameKey: string;
  unitKey?: string;
  read(snapshot: RuntimeStatusSnapshot, messages: Messages): string | number;
}

export const RUNTIME_METRICS: readonly RuntimeMetric[] = [
  {
    id: "discordReady",
    nameKey: "metric.discordReady.name",
    read: (s, m) => m.t(s.discord.ready ? "metric.value.yes" : "metric.value.no"),
  },
  {
    id: "discordPing",
    nameKey: "metric.discordPing.name",
    unitKey: "metric.discordPing.unit",
    read: (s, m) => s.discord.pingMs ?? m.t("metric.value.na"),
  },
  { id: "guilds", nameKey: "metric.guilds.name", read: (s) => s.discord.guildCount },
  {
    id: "lastSweepStatus",
    nameKey: "metric.lastSweepStatus.name",
    read: (s, m) => s.sweep.last?.status ?? m.t("metric.value.never"),
  },
  {
    id: "lastSweepAt",
    nameKey: "metric.lastSweepAt.name",
    read: (s, m) => s.sweep.last?.finishedAt ?? m.t("metric.value.never"),
  },
  { id: "sweepGranted", nameKey: "metric.sweepGranted.name", read: (s) => s.sweep.totals.granted },
  { id: "sweepRevoked", nameKey: "metric.sweepRevoked.name", read: (s) => s.sweep.totals.revoked },
  { id: "sweepFailed", nameKey: "metric.sweepFailed.name", read: (s) => s.sweep.totals.failed },
];
