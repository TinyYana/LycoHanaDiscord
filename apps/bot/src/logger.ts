import { pino, type Logger as PinoLogger } from "pino";

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Thin structured-logging facade over pino. Call sites use `info(msg, fields)`;
 * the implementation forwards to pino. Pretty output in dev, JSON in prod.
 */
export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

function wrap(p: PinoLogger): Logger {
  return {
    debug: (msg, fields) => p.debug(fields ?? {}, msg),
    info: (msg, fields) => p.info(fields ?? {}, msg),
    warn: (msg, fields) => p.warn(fields ?? {}, msg),
    error: (msg, fields) => p.error(fields ?? {}, msg),
  };
}

export function createLogger(level: LogLevel): Logger {
  const pretty = process.env.NODE_ENV !== "production";
  return wrap(
    pino({
      level,
      ...(pretty
        ? {
            transport: {
              target: "pino-pretty",
              options: { translateTime: "SYS:standard", ignore: "pid,hostname" },
            },
          }
        : {}),
    }),
  );
}
