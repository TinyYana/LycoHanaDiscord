import tx2 from "tx2";
import type { Messages } from "../messages";
import type { RuntimeStatus } from "./index";
import { RUNTIME_METRICS } from "./metrics";

/**
 * Expose `RUNTIME_METRICS` as PM2 custom metrics (`pm2 show` / `pm2 monit`).
 * Names/units are resolved once here (PM2 keys metrics by name); values are
 * polled by tx2 about once a second, so word values follow messages edits.
 * A throw inside a poll would become an uncaughtException, hence the guard.
 * Without PM2 (no IPC channel) tx2 sends nothing, so plain `node` is safe.
 */
export function exposePm2Metrics(status: RuntimeStatus, messages: Messages): void {
  for (const metric of RUNTIME_METRICS) {
    tx2.metric({
      name: messages.t(metric.nameKey),
      unit: metric.unitKey && messages.t(metric.unitKey),
      value: () => {
        try {
          return metric.read(status.snapshot(), messages);
        } catch {
          return messages.t("metric.value.error");
        }
      },
    });
  }
}
