import type { AgentId } from "../domain/config";
import type {
  CreatingWorktreeState,
  PendingWorktreeCreationState,
  ResolvedWorktreeCreationPhase,
  WorktreeSource,
} from "../domain/model";

export interface ResolvedWorktreeCreationProgress {
  worktreeId: string;
  branch: string;
  baseBranch?: string;
  path: string;
  profile: string;
  agent: AgentId;
  phase: ResolvedWorktreeCreationPhase;
  source: WorktreeSource;
}

export interface NamingBranchProgress {
  worktreeId: string;
  profile: string;
  agent: AgentId;
  phase: "naming_branch";
  source: WorktreeSource;
}

export type WorktreeCreationProgress = ResolvedWorktreeCreationProgress | NamingBranchProgress;

type TrackedCreation = CreatingWorktreeState | PendingWorktreeCreationState;

/** One entry per worktreeId, so an id is either still naming its branch or
 *  creating its worktree, never both: a snapshot reads it in exactly one list. */
export class WorktreeCreationTracker {
  private readonly worktrees = new Map<string, TrackedCreation>();

  set(progress: WorktreeCreationProgress): void {
    const next: TrackedCreation = progress.phase === "naming_branch"
      ? {
          worktreeId: progress.worktreeId,
          profile: progress.profile,
          agentName: progress.agent,
          phase: progress.phase,
          source: progress.source,
        }
      : {
          worktreeId: progress.worktreeId,
          branch: progress.branch,
          ...(progress.baseBranch ? { baseBranch: progress.baseBranch } : {}),
          path: progress.path,
          profile: progress.profile,
          agentName: progress.agent,
          phase: progress.phase,
          source: progress.source,
        };
    this.worktrees.set(progress.worktreeId, next);
  }

  clear(worktreeId: string): boolean {
    return this.worktrees.delete(worktreeId);
  }

  hasBranch(branch: string): boolean {
    return this.list().some((state) => state.branch === branch);
  }

  list(): CreatingWorktreeState[] {
    return [...this.worktrees.values()]
      .filter((state): state is CreatingWorktreeState => state.phase !== "naming_branch")
      .sort((left, right) => left.branch.localeCompare(right.branch))
      .map((state) => ({ ...state }));
  }

  /** Creations still naming their branch, in the order they were requested. */
  listPending(): PendingWorktreeCreationState[] {
    return [...this.worktrees.values()]
      .filter((state): state is PendingWorktreeCreationState => state.phase === "naming_branch")
      .map((state) => ({ ...state }));
  }
}
