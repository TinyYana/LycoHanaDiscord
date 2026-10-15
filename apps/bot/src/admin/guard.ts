import { timingSafeEqual } from "node:crypto";

/** The panel only ever listens on loopback; this is deliberately not configurable. */
export const ADMIN_HOST = "127.0.0.1";

/** Why a request was refused (all answered with 403). */
export type AdminGuardDenial = "host" | "method" | "origin" | "content-type" | "csrf";

/** The request facts the guard looks at (header values as received). */
export interface AdminRequestFacts {
  method: string;
  host?: string;
  origin?: string;
  contentType?: string;
  csrfToken?: string;
}

export interface AdminGuardOptions {
  port: number;
  /** Per-process random token every write must echo in `X-CSRF-Token`. */
  csrfToken: string;
}

const ALLOWED_METHODS = new Set(["GET", "POST"]);

const allowedHosts = (port: number) => [`127.0.0.1:${port}`, `localhost:${port}`];
const allowedOrigins = (port: number) => allowedHosts(port).map((host) => `http://${host}`);

/** Constant-time comparison for equal-length values; anything else is a mismatch. */
export function tokensMatch(given: string | undefined, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function mediaType(contentType: string | undefined): string | undefined {
  return contentType?.split(";")[0].trim().toLowerCase();
}

interface GuardRule {
  denial: AdminGuardDenial;
  /** Only checked for writes (any method other than GET). */
  writeOnly: boolean;
  ok(req: AdminRequestFacts, options: AdminGuardOptions, write: boolean): boolean;
}

/**
 * Ordered checks; the first failing rule decides. Host is checked for every
 * request (defeats DNS rebinding). Origin, when a browser sends one, must be
 * the panel itself; writes must also carry it, plus JSON and the CSRF token.
 */
const GUARD_RULES: readonly GuardRule[] = [
  {
    denial: "host",
    writeOnly: false,
    ok: (req, o) => allowedHosts(o.port).includes(req.host?.toLowerCase() ?? ""),
  },
  { denial: "method", writeOnly: false, ok: (req) => ALLOWED_METHODS.has(req.method) },
  {
    denial: "origin",
    writeOnly: false,
    ok: (req, o, write) =>
      req.origin === undefined ? !write : allowedOrigins(o.port).includes(req.origin),
  },
  {
    denial: "content-type",
    writeOnly: true,
    ok: (req) => mediaType(req.contentType) === "application/json",
  },
  { denial: "csrf", writeOnly: true, ok: (req, o) => tokensMatch(req.csrfToken, o.csrfToken) },
];

/** The reason to refuse this request, or undefined when it may proceed. */
export function checkAdminRequest(
  req: AdminRequestFacts,
  options: AdminGuardOptions,
): AdminGuardDenial | undefined {
  const write = req.method !== "GET";
  const failed = GUARD_RULES.find(
    (rule) => (write || !rule.writeOnly) && !rule.ok(req, options, write),
  );
  return failed?.denial;
}
