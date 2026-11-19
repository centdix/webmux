import { LifecycleError } from "./lifecycle-service";

export interface WorktreeNameResolverDependencies {
  runtime: { getWorktreeByBranch(branch: string): { worktreeId: string } | null };
  /** Forced reconcile, refreshing the runtime from git and tmux. */
  reconcile: () => Promise<void>;
}

/** Translate a route's worktree name (its branch) to the worktree id, once, at the request
 *  boundary. A name unknown to the runtime may belong to a worktree created or renamed since
 *  the last reconcile, so reconcile once before answering 404. */
export async function resolveWorktreeIdByName(
  name: string,
  deps: WorktreeNameResolverDependencies,
): Promise<string> {
  let state = deps.runtime.getWorktreeByBranch(name);
  if (!state) {
    await deps.reconcile();
    state = deps.runtime.getWorktreeByBranch(name);
  }
  if (!state) {
    throw new LifecycleError(`Worktree not found: ${name}`, 404);
  }
  return state.worktreeId;
}
