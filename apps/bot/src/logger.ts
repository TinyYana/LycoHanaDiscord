/**
 * Minimal structured logger: one JSON object per line, level-filtered.
 * Dependency-free — enough for a single-process bot, swappable later.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  /** Derive a logger that always includes `bindings` in its output. */
  child(bindings: Record<string, unknown>): Logger;
}

export function createLogger(minLevel: LogLevel, base: Record<string, unknown> = {}): Logger {
  const threshold = LEVEL_ORDER[minLevel];

  function log(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < threshold) return;
    const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...base, ...fields });
    (level === "warn" || level === "error" ? process.stderr : process.stdout).write(`${line}\n`);
  }

  return {
    debug: (msg, fields) => log("debug", msg, fields),
    info: (msg, fields) => log("info", msg, fields),
    warn: (msg, fields) => log("warn", msg, fields),
    error: (msg, fields) => log("error", msg, fields),
    child: (bindings) => createLogger(minLevel, { ...base, ...bindings }),
  };
}
