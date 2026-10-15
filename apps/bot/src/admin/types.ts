import type { Client, Guild } from "discord.js";
import type { Repositories } from "@lycohana/db";
import type { Logger } from "../logger";
import type { RuntimeConfig } from "../config/runtime";
import type { Messages } from "../messages";
import type { RuntimeStatus } from "../runtime-status";

/** Everything the panel reads or writes, injected from the composition root. */
export interface AdminDeps {
  logger: Logger;
  repos: Repositories;
  config: RuntimeConfig;
  client: Client;
  runtimeStatus: RuntimeStatus;
  messages: Messages;
}

export interface AdminRequest {
  /** `:name` segments of the matched route path. */
  params: Record<string, string>;
  /** Parsed JSON body (write routes only). */
  body: unknown;
  csrfToken: string;
}

export type AdminResult =
  | { status: number; json: unknown }
  /** A file from the panel's public directory, read from disk per request. */
  | { status: number; file: string; contentType: string };

/** One validation problem; `field` is a setting/form key, absent for form-level issues. */
export interface AdminFieldError {
  field?: string;
  text: string;
}

/**
 * An expected failure answered to the browser as `{ ok: false, error }`. Only
 * the message key (and its text) leaves the process; details go to the logger.
 */
export class AdminError extends Error {
  constructor(
    readonly status: number,
    readonly key: string,
    readonly fieldErrors: AdminFieldError[] = [],
  ) {
    super(key);
  }
}

export interface AdminRoute {
  method: "GET" | "POST";
  /** Literal segments and `:param` segments, e.g. `/api/guilds/:guildId/config`. */
  path: string;
  /** Writes get the body parsed (and always pass the write checks in the guard). */
  write: boolean;
  handle(deps: AdminDeps, req: AdminRequest): Promise<AdminResult> | AdminResult;
}

export const okJson = (data: Record<string, unknown>): AdminResult => ({
  status: 200,
  json: { ok: true, ...data },
});

/** The cached guild for a route's `:guildId`, or a 404. */
export function requireGuild(deps: AdminDeps, guildId: string | undefined): Guild {
  const guild = guildId ? deps.client.guilds.cache.get(guildId) : undefined;
  if (!guild) throw new AdminError(404, "admin.error.guild-not-found");
  return guild;
}
