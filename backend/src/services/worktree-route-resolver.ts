import { LifecycleError } from "./lifecycle-service";
import type { WorktreeBusyGuards } from "./worktree-busy-guards";

export interface RouteWorktree {
  worktreeId: string;
  branch: string;
}

export interface WorktreeRouteResolverDependencies<T extends RouteWorktree> {
  runtime: { getWorktree(worktreeId: string): T | null };
  /** Forced reconcile, refreshing the runtime from git and tmux. */
  reconcile: () => Promise<void>;
  guards: WorktreeBusyGuards;
}

/** Check a route's worktree id against the runtime and return the worktree's runtime state.
 *  An id missing from the runtime answers 409 while it is being created or removed (a reconcile
 *  can drop a worktree mid-removal); otherwise it may belong to a worktree created since the last
 *  reconcile, so reconcile once before answering 404. With `requireIdle`, a known worktree that is
 *  being created, removed, or has its tabs updated also answers 409. */
export async function resolveRouteWorktree<T extends RouteWorktree>(
  worktreeId: string,
  deps: WorktreeRouteResolverDependencies<T>,
  options: { requireIdle: boolean },
): Promise<T> {
  let state = deps.runtime.getWorktree(worktreeId);
  if (!state) {
    if (deps.guards.isCreating(worktreeId)) {
      throw new LifecycleError(`Worktree is being created: ${worktreeId}`, 409);
    }
    if (deps.guards.isRemoving(worktreeId)) {
      throw new LifecycleError(`Worktree is being removed: ${worktreeId}`, 409);
    }
    await deps.reconcile();
    state = deps.runtime.getWorktree(worktreeId);
  }
  if (!state) {
    throw new LifecycleError(`Worktree not found: ${worktreeId}`, 404);
  }
  if (options.requireIdle) {
    deps.guards.ensureNotBusy(state.worktreeId, state.branch);
  }
  return state;
}
