import { basename, resolve } from "node:path";
import type { GitGateway, GitWorktreeEntry } from "../adapters/git";
import { readWorktreeMeta } from "../adapters/fs";
import {
  buildWorktreeParkingWindowName,
  buildWorktreeWindowName,
  type TmuxWindowRole,
  type TmuxWindowSummary,
} from "../adapters/tmux";

/** URL-safe id for a worktree without webmux metadata, derived from its path so it stays the
 *  same across reconciles and when webmux adopts the worktree. */
export function makeUnmanagedWorktreeId(path: string): string {
  return `u-${new Bun.CryptoHasher("sha256").update(resolve(path)).digest("hex").slice(0, 16)}`;
}

/** The id of the worktree at `path`: its meta's id, else the unmanaged id derived from the path. */
export function resolveWorktreeId(meta: { worktreeId: string } | null, path: string): string {
  return meta?.worktreeId ?? makeUnmanagedWorktreeId(path);
}

/** Read the id of the worktree checked out at `path` (see {@link resolveWorktreeId}). */
export async function readWorktreeIdAt(git: Pick<GitGateway, "resolveWorktreeGitDir">, path: string): Promise<string> {
  return resolveWorktreeId(await readWorktreeMeta(git.resolveWorktreeGitDir(path)), path);
}

/** Locate a worktree's window by its stable id anchor, falling back to the legacy name match for
 *  windows created before the anchor existed (they get backfilled by healWindowNames). Matching on
 *  the anchor is what survives an in-worktree `git checkout -b`, which changes the branch — and so
 *  the expected window name — while the live window keeps the name it was born with. */
export function findWindow(
  windows: TmuxWindowSummary[],
  sessionName: string,
  worktreeId: string,
  branch: string,
  role: TmuxWindowRole = "main",
): TmuxWindowSummary | null {
  const anchored = windows.find((window) =>
    window.sessionName === sessionName
    && window.worktreeId === worktreeId
    && window.role === role
  );
  if (anchored) return anchored;

  const windowName = role === "parking"
    ? buildWorktreeParkingWindowName(branch)
    : buildWorktreeWindowName(branch);
  return windows.find((window) =>
    window.sessionName === sessionName
    && window.windowName === windowName
    && window.worktreeId === null
  ) ?? null;
}

/** The branch a worktree is listed (and addressed from the CLI) by: git's branch, else the branch
 *  its meta recorded (detached HEAD, e.g. mid-rebase), else its directory name. */
export function labelWorktreeBranch(entry: Pick<GitWorktreeEntry, "path" | "branch">, metaBranch: string | null): string {
  const fallback = basename(entry.path);
  return entry.branch ?? metaBranch ?? (fallback.length > 0 ? fallback : "unknown");
}
