import { LifecycleError } from "./lifecycle-service";

/** In-flight operations a worktree id can be busy with. Requests for a busy worktree answer 409. */
export class WorktreeBusyGuards {
  private readonly removing = new Set<string>();
  private readonly mutatingTab = new Set<string>();

  /** `isCreating`: whether the id belongs to a worktree still being created. */
  constructor(readonly isCreating: (worktreeId: string) => boolean) {}

  isRemoving(worktreeId: string): boolean {
    return this.removing.has(worktreeId);
  }

  markRemoving(worktreeId: string): void {
    this.removing.add(worktreeId);
  }

  unmarkRemoving(worktreeId: string): void {
    this.removing.delete(worktreeId);
  }

  /** Throw a 409 when the worktree is being created, removed, or has its tabs updated.
   *  `label` names the worktree in the message (its branch when known). */
  ensureNotBusy(worktreeId: string, label: string): void {
    if (this.isCreating(worktreeId)) {
      throw new LifecycleError(`Worktree is being created: ${label}`, 409);
    }
    if (this.removing.has(worktreeId)) {
      throw new LifecycleError(`Worktree is being removed: ${label}`, 409);
    }
    if (this.mutatingTab.has(worktreeId)) {
      throw new LifecycleError(`Worktree tabs are being updated: ${label}`, 409);
    }
  }

  async withRemoving<T>(worktreeId: string, label: string, fn: () => Promise<T>): Promise<T> {
    this.ensureNotBusy(worktreeId, label);
    this.removing.add(worktreeId);
    try {
      return await fn();
    } finally {
      this.removing.delete(worktreeId);
    }
  }

  /** Tab create/select/delete each read-modify-write the worktree meta. Open and agent-terminal
   *  refresh also rewrite the whole tabs array (via restoreWorktreeTabs). Serialize them all per
   *  worktree (and mutually exclude with remove/create) so concurrent requests from the CLI or
   *  multiple clients can't clobber each other's tab bookkeeping. */
  async withMutatingTab<T>(worktreeId: string, label: string, fn: () => Promise<T>): Promise<T> {
    this.ensureNotBusy(worktreeId, label);
    this.mutatingTab.add(worktreeId);
    try {
      return await fn();
    } finally {
      this.mutatingTab.delete(worktreeId);
    }
  }
}

export interface WorktreeIdResolverDependencies {
  runtime: { getWorktree(worktreeId: string): { worktreeId: string; branch: string } | null };
  /** Forced reconcile, refreshing the runtime from git and tmux. */
  reconcile: () => Promise<void>;
  guards: WorktreeBusyGuards;
}

/** Check a route's worktree id against the runtime and return the worktree's current branch.
 *  An id missing from the runtime answers 409 while it is being created or removed (a reconcile
 *  can drop a worktree mid-removal); otherwise it may belong to a worktree created since the last
 *  reconcile, so reconcile once before answering 404. With `requireIdle`, a known worktree that is
 *  being created, removed, or has its tabs updated also answers 409. */
export async function resolveRouteWorktree(
  worktreeId: string,
  deps: WorktreeIdResolverDependencies,
  options: { requireIdle: boolean },
): Promise<{ worktreeId: string; branch: string }> {
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
  return { worktreeId: state.worktreeId, branch: state.branch };
}
