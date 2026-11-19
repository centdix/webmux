import { BunGitGateway, type GitGateway } from "../../backend/src/adapters/git";
import { listLiveProjectWorktrees } from "../../backend/src/services/lifecycle-service";
import { readWorktreeIdAt } from "../../backend/src/services/reconciliation-service";
import { resolveProjectRoot } from "./shared";

export interface WorktreeIdSource {
  projectDir: string;
  git: Pick<GitGateway, "resolveWorktreeGitDir"> & {
    listLiveWorktrees(cwd: string): Array<{ path: string; branch: string | null; bare: boolean }>;
  };
}

/** Translate a branch argument to the id its worktree is addressed by (lifecycle service and API routes). */
export async function resolveWorktreeIdByBranch(source: WorktreeIdSource, branch: string): Promise<string> {
  const entry = listLiveProjectWorktrees(source.git, source.projectDir)
    .find((candidate) => candidate.branch === branch);
  if (!entry) {
    throw new Error(`Worktree not found: ${branch}`);
  }
  return await readWorktreeIdAt(source.git, entry.path);
}

/** {@link resolveWorktreeIdByBranch} for a CLI run from anywhere in the project (main checkout or a worktree). */
export function resolveWorktreeIdInProject(cwd: string, branch: string): Promise<string> {
  return resolveWorktreeIdByBranch({ git: new BunGitGateway(), projectDir: resolveProjectRoot(cwd) ?? cwd }, branch);
}
