import type { AppNotification, WorktreeInfo, WorktreeRef } from "./types";

/** Project prefixes are `[a-z0-9-]` slugs, so the first `:` always splits a
 *  key back into its project and worktree id. */
const KEY_SEPARATOR = ":";

/** Stable string identity of a worktree across projects (Set/Map/storage key,
 *  row identity): the runtime worktree id, not the branch. */
export function worktreeKey(ref: WorktreeRef): string {
  return `${ref.project}${KEY_SEPARATOR}${ref.id}`;
}

/** The key older versions saved, naming the branch in place of the id;
 *  `migrateBranchKeys` moves it to the id. */
export function legacyBranchKey(project: string, branch: string): string {
  return `${project}${KEY_SEPARATOR}${branch}`;
}

export function parseWorktreeKey(key: string): WorktreeRef | null {
  const index = key.indexOf(KEY_SEPARATOR);
  if (index <= 0 || index === key.length - 1) return null;
  return { project: key.slice(0, index), id: key.slice(index + 1) };
}

export function sameWorktree(a: WorktreeRef | null | undefined, b: WorktreeRef | null | undefined): boolean {
  return !!a && !!b && a.project === b.project && a.id === b.id;
}

/** Just the identity, so a ref never carries a stale copy of the worktree. */
export function refOf(ref: WorktreeRef): WorktreeRef {
  return { project: ref.project, id: ref.id };
}

/** The worktree a saved name points at: its id, or a branch saved by older versions. */
export function findSavedWorktree<T extends Pick<WorktreeInfo, "id" | "branch">>(worktrees: T[], name: string): T | undefined {
  return worktrees.find((worktree) => worktree.id === name) ?? worktrees.find((worktree) => worktree.branch === name);
}

/** Move keys naming a branch (saved by older versions) to the id of the
 *  worktree on that branch. `worktreesOf` is null until a project's list has
 *  loaded: its keys, and keys naming no worktree, stay as they are. Returns
 *  null when nothing changed. */
export function migrateBranchKeys(
  keys: ReadonlySet<string>,
  worktreesOf: (project: string) => Array<Pick<WorktreeInfo, "project" | "id" | "branch">> | null,
): Set<string> | null {
  let changed = false;
  const migrated = new Set<string>();
  for (const key of keys) {
    const parsed = parseWorktreeKey(key);
    const worktrees = parsed ? worktreesOf(parsed.project) : null;
    const match = parsed && worktrees ? findSavedWorktree(worktrees, parsed.id) : undefined;
    const next = match ? worktreeKey(match) : key;
    if (next !== key) changed = true;
    migrated.add(next);
  }
  return changed ? migrated : null;
}

/** Notification ids are only unique per project. */
export function notificationKey(notification: Pick<AppNotification, "project" | "id">): string {
  return `${notification.project}${KEY_SEPARATOR}${notification.id}`;
}
