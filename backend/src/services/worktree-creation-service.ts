import type { AgentId } from "../domain/config";
import type { CreatingWorktreeState, WorktreeCreationPhase, WorktreeSource } from "../domain/model";

export interface WorktreeCreationProgress {
  worktreeId: string;
  branch: string;
  baseBranch?: string;
  path: string;
  profile: string;
  agent: AgentId;
  phase: WorktreeCreationPhase;
  source: WorktreeSource;
}

export class WorktreeCreationTracker {
  private readonly worktrees = new Map<string, CreatingWorktreeState>();

  set(progress: WorktreeCreationProgress): void {
    const next: CreatingWorktreeState = {
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
    return [...this.worktrees.values()].some((state) => state.branch === branch);
  }

  list(): CreatingWorktreeState[] {
    return [...this.worktrees.values()]
      .sort((left, right) => left.branch.localeCompare(right.branch))
      .map((state) => ({ ...state }));
  }
}
