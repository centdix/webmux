import { BunGitGateway, type GitGateway } from "../../backend/src/adapters/git";
import { readWorktreeMeta } from "../../backend/src/adapters/fs";
import { listLiveProjectWorktrees } from "../../backend/src/services/lifecycle-service";
import { labelWorktreeBranch, readWorktreeIdAt, resolveWorktreeId } from "../../backend/src/services/worktree-identity";
import { resolveProjectRoot } from "./shared";

export interface WorktreeIdSource {
  projectDir: string;
  git: Pick<GitGateway, "resolveWorktreeGitDir"> & {
    listLiveWorktrees(cwd: string): Array<{ path: string; branch: string | null; bare: boolean }>;
  };
}

/** Translate a branch argument to the id its worktree is addressed by (lifecycle service and API
 *  routes), matching the branch the server lists the worktree under; null when no worktree has it.
 *  Every CLI command resolves through here, against live git, since the in-process lifecycle
 *  commands run without a server. */
export async function findWorktreeIdByBranch(source: WorktreeIdSource, branch: string): Promise<string | null> {
  const entries = listLiveProjectWorktrees(source.git, source.projectDir);
  const onBranch = entries.find((entry) => entry.branch === branch);
  if (onBranch) return await readWorktreeIdAt(source.git, onBranch.path);
  // A worktree without a git branch (detached HEAD) is listed under its meta branch or directory name.
  for (const entry of entries.filter((candidate) => candidate.branch === null)) {
    const meta = await readWorktreeMeta(source.git.resolveWorktreeGitDir(entry.path));
    if (labelWorktreeBranch(entry, meta?.branch ?? null) === branch) return resolveWorktreeId(meta, entry.path);
  }
  return null;
}

/** {@link findWorktreeIdByBranch}, throwing when no worktree has the branch. */
export async function resolveWorktreeIdByBranch(source: WorktreeIdSource, branch: string): Promise<string> {
  const worktreeId = await findWorktreeIdByBranch(source, branch);
  if (!worktreeId) throw new Error(`Worktree not found: ${branch}`);
  return worktreeId;
}

function projectSource(cwd: string): WorktreeIdSource {
  return { git: new BunGitGateway(), projectDir: resolveProjectRoot(cwd) ?? cwd };
}

/** {@link findWorktreeIdByBranch} for a CLI run from anywhere in the project (main checkout or a worktree). */
export function findWorktreeIdInProject(cwd: string, branch: string): Promise<string | null> {
  return findWorktreeIdByBranch(projectSource(cwd), branch);
}

/** {@link resolveWorktreeIdByBranch} for a CLI run from anywhere in the project (main checkout or a worktree). */
export function resolveWorktreeIdInProject(cwd: string, branch: string): Promise<string> {
  return resolveWorktreeIdByBranch(projectSource(cwd), branch);
}
