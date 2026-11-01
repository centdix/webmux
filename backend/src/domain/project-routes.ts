import { projectApiBasePath, projectApiPaths } from "@webmux/api-contract";

/** Pre-`/api/projects` path agent hooks POST runtime events to. Sessions opened
 *  before the move still carry it in their control.env. */
export function legacyRuntimeEventsPath(prefix: string): string {
  return `/${prefix}/api/runtime/events`;
}

/** Re-key one project's (relative) route map under `projectApiBasePath(prefix)`
 *  for the shared server, plus the legacy runtime-events alias. */
export function mountProjectRoutes<TEntry>(prefix: string, routes: Record<string, TEntry>): Record<string, TEntry> {
  const base = projectApiBasePath(prefix);
  const mounted: Record<string, TEntry> = {};
  for (const [pattern, entry] of Object.entries(routes)) {
    mounted[`${base}${pattern}`] = entry;
  }
  // Compat alias for sessions whose control.env predates `/api/projects/<prefix>`.
  // Remove once every agent session has been reopened (control.env rewritten).
  const runtimeEvents = routes[projectApiPaths.postRuntimeEvent];
  if (runtimeEvents !== undefined) mounted[legacyRuntimeEventsPath(prefix)] = runtimeEvents;
  return mounted;
}

/** True for `/api`, `/api/...` and legacy `/<prefix>/api(/...)` paths: requests that
 *  reach the fallback handler there must 404 as JSON, not fall through to the SPA. */
export function isApiPath(pathname: string): boolean {
  return /^(\/[^/]+)?\/api(\/|$)/.test(pathname);
}

/** Where an old `/<prefix>` or `/<prefix>/...` bookmark of a registered
 *  project now lives (`/#<prefix>`); `null` for any other path. */
export function legacyProjectRedirect(pathname: string, isProject: (prefix: string) => boolean): string | null {
  if (isApiPath(pathname)) return null;
  const prefix = pathname.split("/")[1] ?? "";
  return prefix && isProject(prefix) ? `/#${prefix}` : null;
}

/** Merge the hub routes with every project's mounted routes. Hub entries are
 *  applied last so a project route can never replace one. */
export function assembleServeRoutes<TEntry>(
  hubRoutes: Record<string, TEntry>,
  projects: Iterable<{ prefix: string; routes: Record<string, TEntry> }>,
): Record<string, TEntry> {
  const routes: Record<string, TEntry> = {};
  for (const project of projects) {
    Object.assign(routes, mountProjectRoutes(project.prefix, project.routes));
  }
  return Object.assign(routes, hubRoutes);
}
