import { bootstrap, listGuilds, preview, status } from "./handlers";
import { getConfig, saveConfig } from "./settings";
import type { AdminResult, AdminRoute } from "./types";

const staticFile = (file: string, contentType: string) => (): AdminResult => ({
  status: 200,
  file,
  contentType,
});

/** Every URL the panel answers. Anything not listed here is a 404. */
export const ADMIN_ROUTES: readonly AdminRoute[] = [
  {
    method: "GET",
    path: "/",
    write: false,
    handle: staticFile("index.html", "text/html; charset=utf-8"),
  },
  {
    method: "GET",
    path: "/app.js",
    write: false,
    handle: staticFile("app.js", "text/javascript; charset=utf-8"),
  },
  {
    method: "GET",
    path: "/app.css",
    write: false,
    handle: staticFile("app.css", "text/css; charset=utf-8"),
  },
  {
    method: "GET",
    path: "/favicon.svg",
    write: false,
    handle: staticFile("favicon.svg", "image/svg+xml"),
  },
  { method: "GET", path: "/api/bootstrap", write: false, handle: bootstrap },
  { method: "GET", path: "/api/status", write: false, handle: status },
  { method: "GET", path: "/api/guilds", write: false, handle: listGuilds },
  { method: "GET", path: "/api/guilds/:guildId/config", write: false, handle: getConfig },
  { method: "POST", path: "/api/guilds/:guildId/config", write: true, handle: saveConfig },
  { method: "GET", path: "/api/guilds/:guildId/preview", write: false, handle: preview },
];

function matchPath(pattern: string, pathname: string): Record<string, string> | undefined {
  const want = pattern.split("/");
  const got = pathname.split("/");
  if (want.length !== got.length) return undefined;
  const params: Record<string, string> = {};
  for (const [i, segment] of want.entries()) {
    if (segment.startsWith(":")) params[segment.slice(1)] = got[i];
    else if (segment !== got[i]) return undefined;
  }
  return params;
}

export function matchRoute(
  method: string,
  pathname: string,
): { route: AdminRoute; params: Record<string, string> } | undefined {
  for (const route of ADMIN_ROUTES) {
    if (route.method !== method) continue;
    const params = matchPath(route.path, pathname);
    if (params) return { route, params };
  }
  return undefined;
}
