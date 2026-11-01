import type { DashboardActivityTracker } from "./dashboard-activity";
import type { ReconcileOptions } from "./reconciliation-service";

/** Idle projects (no open socket) still need dirty/ahead, tmux state and
 *  out-of-band worktree changes refreshed, but only occasionally. */
export const IDLE_PROJECT_RECONCILE_FRESHNESS_MS = 30_000;

/** Reconcile options for one project in the hub listing: active projects use
 *  the service's default freshness, idle ones a long staleness window. */
export function hubReconcileOptions(active: boolean): ReconcileOptions {
  return active ? {} : { freshnessMs: IDLE_PROJECT_RECONCILE_FRESHNESS_MS };
}

/** A project's worktrees plus its creations still naming their branch. */
export interface ProjectWorktreesListing<T, P> {
  worktrees: T[];
  pendingCreations: P[];
}

export interface ProjectWorktreesSource<T, P> {
  prefix: string;
  name: string;
  readWorktrees: () => Promise<ProjectWorktreesListing<T, P>>;
  /** Whether the project is still served once its read settles. */
  isServed: () => boolean;
}

export interface ProjectWorktreesResult<T, P> extends ProjectWorktreesListing<T, P> {
  prefix: string;
  name: string;
  error: string | null;
}

/** Start every project's read at once and wait for all of them (the reads
 *  themselves may still block on synchronous git calls). One project failing yields an
 *  entry with `error` set and no worktrees; the others are still returned, in
 *  input order. A project removed while being read is left out. */
export async function collectAllProjectWorktrees<T, P>(
  projects: ProjectWorktreesSource<T, P>[],
): Promise<ProjectWorktreesResult<T, P>[]> {
  const settled = await Promise.allSettled(projects.map((project) => project.readWorktrees()));
  return projects.flatMap((project, index): ProjectWorktreesResult<T, P>[] => {
    if (!project.isServed()) return [];
    const result = settled[index];
    return [result.status === "fulfilled"
      ? { prefix: project.prefix, name: project.name, ...result.value, error: null }
      : {
          prefix: project.prefix,
          name: project.name,
          worktrees: [],
          pendingCreations: [],
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        }];
  });
}

/** The hub listing behind the dashboard's poll. Only the dashboard calls it,
 *  so every call counts as dashboard activity; `focus` marks that project
 *  focused unless it isn't one of `projects` (empty or unknown: ignored). */
export async function listAllProjectWorktrees<T, P>(
  focus: string | undefined,
  projects: ProjectWorktreesSource<T, P>[],
  activity: Pick<DashboardActivityTracker, "touch">,
): Promise<ProjectWorktreesResult<T, P>[]> {
  activity.touch(projects.some((project) => project.prefix === focus) ? focus : undefined);
  return collectAllProjectWorktrees(projects);
}
