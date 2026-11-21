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
