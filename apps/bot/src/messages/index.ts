import { readFileSync, statSync } from "node:fs";
import type { Logger } from "../logger";
import { errMessage } from "../errors";

export type MessageParams = Record<string, string | number>;

/** Operator/user-facing text, looked up by key from a JSON file. */
export interface Messages {
  /** Text for `key` with `{name}` placeholders filled; the key itself if missing. */
  t(key: string, params?: MessageParams): string;
  /** Every entry whose key starts with `prefix` (raw text, placeholders kept). */
  withPrefix(prefix: string): Record<string, string>;
}

type Table = Record<string, string>;

function parseTable(raw: string): Table {
  const data: unknown = JSON.parse(raw);
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("messages file must be a JSON object of key → string");
  }
  const bad = Object.entries(data).find(([, value]) => typeof value !== "string");
  if (bad) throw new Error(`message "${bad[0]}" is not a string`);
  return data as Table;
}

function interpolate(text: string, params: MessageParams | undefined): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Hot-reloading messages: every lookup checks the file's mtime and re-reads it
 * when it changed, so edits apply without a restart. A file that cannot be
 * read or parsed keeps the last good table (error logged once per failure);
 * a missing key returns the key itself (warned once per key).
 */
export function createMessages(filePath: string, logger: Logger): Messages {
  let table: Table = {};
  let seenMtime = -1; // mtime of the last attempted load (good or bad)
  let lastError: string | undefined;
  const warnedKeys = new Set<string>();

  function reportError(error: unknown): void {
    const message = errMessage(error);
    if (message !== lastError) {
      logger.error("messages load failed; keeping previous text", {
        file: filePath,
        error: message,
      });
    }
    lastError = message;
  }

  function refresh(): void {
    try {
      const mtime = statSync(filePath).mtimeMs;
      if (mtime === seenMtime) return;
      seenMtime = mtime;
      table = parseTable(readFileSync(filePath, "utf8"));
      lastError = undefined;
      warnedKeys.clear();
      logger.info("messages loaded", { file: filePath, keys: Object.keys(table).length });
    } catch (error) {
      reportError(error);
    }
  }

  refresh();
  return {
    t(key, params) {
      refresh();
      if (!Object.hasOwn(table, key)) {
        if (!warnedKeys.has(key)) logger.warn("message key missing", { key, file: filePath });
        warnedKeys.add(key);
        return key;
      }
      return interpolate(table[key], params);
    },
    withPrefix(prefix) {
      refresh();
      return Object.fromEntries(Object.entries(table).filter(([key]) => key.startsWith(prefix)));
    },
  };
}
