import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type OutgoingHttpHeaders,
  type Server,
  type ServerResponse,
} from "node:http";
import path from "node:path";
import { REPO_ROOT } from "../config/runtime";
import { errMessage } from "../errors";
import { ADMIN_HOST, checkAdminRequest } from "./guard";
import { matchRoute } from "./routes";
import { AdminError, type AdminDeps, type AdminFieldError, type AdminResult } from "./types";

export type { AdminDeps } from "./types";

/**
 * Static page files, read from disk on every request so edits show on refresh.
 * Resolved from the repo root, so `src` (tsx) and `dist` (node) both find them.
 */
const PUBLIC_DIR = path.join(REPO_ROOT, "apps/bot/src/admin/public");
/** Settings bodies are tiny; anything bigger is refused. */
const MAX_BODY_BYTES = 64 * 1024;

const SECURITY_HEADERS: OutgoingHttpHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

export interface AdminServer {
  url: string;
  close(): Promise<void>;
}

interface PanelContext {
  deps: AdminDeps;
  port: number;
  csrfToken: string;
}

function errorResult(
  deps: AdminDeps,
  status: number,
  key: string,
  fieldErrors: AdminFieldError[] = [],
): AdminResult {
  return {
    status,
    json: { ok: false, error: { key, text: deps.messages.t(key) }, fieldErrors },
  };
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new AdminError(413, "admin.error.body-too-large");
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AdminError(400, "admin.error.bad-json");
  }
}

/** Guard → route → (body) → handler. Expected failures become `{ ok: false }` JSON. */
async function dispatch(req: IncomingMessage, ctx: PanelContext): Promise<AdminResult> {
  const method = req.method ?? "GET";
  const pathname = new URL(req.url ?? "/", `http://${ADMIN_HOST}`).pathname;
  const denial = checkAdminRequest(
    {
      method,
      host: header(req, "host"),
      origin: header(req, "origin"),
      contentType: header(req, "content-type"),
      csrfToken: header(req, "x-csrf-token"),
    },
    { port: ctx.port, csrfToken: ctx.csrfToken },
  );
  if (denial) {
    ctx.deps.logger.warn("admin: request refused", { denial, method, path: pathname });
    return errorResult(ctx.deps, 403, "admin.error.forbidden");
  }
  const match = matchRoute(method, pathname);
  if (!match) return errorResult(ctx.deps, 404, "admin.error.not-found");
  const body = match.route.write ? await readJsonBody(req) : undefined;
  return match.route.handle(ctx.deps, {
    params: match.params,
    body,
    csrfToken: ctx.csrfToken,
  });
}

async function send(res: ServerResponse, result: AdminResult): Promise<void> {
  if ("file" in result) {
    const content = await readFile(path.join(PUBLIC_DIR, result.file));
    res.writeHead(result.status, { ...SECURITY_HEADERS, "Content-Type": result.contentType });
    res.end(content);
    return;
  }
  res.writeHead(result.status, {
    ...SECURITY_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(result.json));
}

async function handle(req: IncomingMessage, res: ServerResponse, ctx: PanelContext) {
  try {
    await send(res, await dispatch(req, ctx));
  } catch (error) {
    if (error instanceof AdminError) {
      await send(res, errorResult(ctx.deps, error.status, error.key, error.fieldErrors));
      return;
    }
    // Details stay in the log; the browser only gets a message key.
    ctx.deps.logger.error("admin: request failed", { url: req.url, error: errMessage(error) });
    if (!res.headersSent) await send(res, errorResult(ctx.deps, 500, "admin.error.internal"));
    else res.destroy();
  }
}

/** Resolves true once listening, false (logged) on a listen error such as EADDRINUSE. */
function listen(server: Server, port: number, deps: AdminDeps): Promise<boolean> {
  return new Promise((resolve) => {
    server.once("error", (error: NodeJS.ErrnoException) => {
      deps.logger.error("admin panel failed to start; the bot keeps running without it", {
        host: ADMIN_HOST,
        port,
        code: error.code,
        error: error.message,
        hint: deps.messages.t("admin.log.listen-failed", { port }),
      });
      resolve(false);
    });
    server.listen(port, ADMIN_HOST, () => resolve(true));
  });
}

/**
 * Start the local admin panel on 127.0.0.1 only. Returns undefined when it is
 * disabled or cannot listen — the bot runs on either way.
 */
export async function startAdminServer(deps: AdminDeps): Promise<AdminServer | undefined> {
  const { enabled, port } = deps.config.adminPanel;
  if (!enabled) {
    deps.logger.info("admin panel disabled (ADMIN_PANEL_ENABLED=false)");
    return undefined;
  }
  const ctx: PanelContext = { deps, port, csrfToken: randomBytes(32).toString("base64url") };
  const server = createServer((req, res) => void handle(req, res, ctx));
  if (!(await listen(server, port, deps))) return undefined;
  server.on("error", (error) => deps.logger.error("admin panel error", { error: error.message }));

  const url = `http://${ADMIN_HOST}:${port}/`;
  deps.logger.info("admin panel listening", { url });
  return {
    url,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
