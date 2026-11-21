import { LifecycleError } from "./lifecycle-service";

export interface WorktreeIdResolverDependencies {
  runtime: { getWorktree(worktreeId: string): { worktreeId: string; branch: string } | null };
  /** Forced reconcile, refreshing the runtime from git and tmux. */
  reconcile: () => Promise<void>;
  /** Whether the id belongs to a worktree still being created. */
  isCreating: (worktreeId: string) => boolean;
}

/** Check a route's worktree id against the runtime and return the worktree's current branch
 *  (the busy guards are keyed by branch). An id unknown to the runtime may belong to a worktree
 *  created since the last reconcile, so reconcile once before answering 409 (still being
 *  created) or 404. */
export async function resolveRouteWorktree(
  worktreeId: string,
  deps: WorktreeIdResolverDependencies,
): Promise<{ worktreeId: string; branch: string }> {
  let state = deps.runtime.getWorktree(worktreeId);
  if (!state) {
    await deps.reconcile();
    state = deps.runtime.getWorktree(worktreeId);
  }
  if (!state) {
    if (deps.isCreating(worktreeId)) {
      throw new LifecycleError(`Worktree is being created: ${worktreeId}`, 409);
    }
    throw new LifecycleError(`Worktree not found: ${worktreeId}`, 404);
  }
  return { worktreeId: state.worktreeId, branch: state.branch };
}
