// Minimal typing for the slice of tx2 (PM2's metrics client) this bot uses.
declare module "tx2" {
  interface Tx2MetricOptions {
    name: string;
    /** Polled by tx2 about once a second; must not throw. */
    value: () => string | number;
    unit?: string;
  }
  const tx2: { metric(options: Tx2MetricOptions): unknown };
  export = tx2;
}
