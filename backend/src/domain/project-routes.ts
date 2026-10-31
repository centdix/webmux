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
