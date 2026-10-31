import type { ReconcileOptions } from "./reconciliation-service";

/** Idle projects (no open socket) still need dirty/ahead, tmux state and
 *  out-of-band worktree changes refreshed, but only occasionally. */
export const IDLE_PROJECT_RECONCILE_FRESHNESS_MS = 30_000;

/** Reconcile options for one project in the hub listing: active projects use
 *  the service's default freshness, idle ones a long staleness window. */
export function hubReconcileOptions(active: boolean): ReconcileOptions {
  return active ? {} : { freshnessMs: IDLE_PROJECT_RECONCILE_FRESHNESS_MS };
}

export interface ProjectWorktreesSource<T> {
  prefix: string;
  name: string;
  readWorktrees: () => Promise<T[]>;
}

export interface ProjectWorktreesResult<T> {
  prefix: string;
  name: string;
  worktrees: T[];
  error: string | null;
}

/** Start every project's read at once and wait for all of them (the reads
 *  themselves may still block on synchronous git calls). One project failing yields an
 *  entry with `error` set and no worktrees; the others are still returned, in
 *  input order. */
export async function collectAllProjectWorktrees<T>(
  projects: ProjectWorktreesSource<T>[],
): Promise<ProjectWorktreesResult<T>[]> {
  const settled = await Promise.allSettled(projects.map((project) => project.readWorktrees()));
  return projects.map((project, index): ProjectWorktreesResult<T> => {
    const result = settled[index];
    return result.status === "fulfilled"
      ? { prefix: project.prefix, name: project.name, worktrees: result.value, error: null }
      : {
          prefix: project.prefix,
          name: project.name,
          worktrees: [],
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        };
  });
}
