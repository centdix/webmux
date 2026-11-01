import type { AppNotification, WorktreeRef } from "./types";

/** Project prefixes are `[a-z0-9-]` slugs and git forbids `:` in ref names, so
 *  the first `:` always splits a key back into its project and branch. */
const KEY_SEPARATOR = ":";

/** Stable string identity of a worktree across projects (Set/Map/storage key). */
export function worktreeKey(ref: WorktreeRef): string {
  return `${ref.project}${KEY_SEPARATOR}${ref.branch}`;
}

export function parseWorktreeKey(key: string): WorktreeRef | null {
  const index = key.indexOf(KEY_SEPARATOR);
  if (index <= 0 || index === key.length - 1) return null;
  return { project: key.slice(0, index), branch: key.slice(index + 1) };
}

export function sameWorktree(a: WorktreeRef | null | undefined, b: WorktreeRef | null | undefined): boolean {
  return !!a && !!b && a.project === b.project && a.branch === b.branch;
}

/** Notification ids are only unique per project. */
export function notificationKey(notification: Pick<AppNotification, "project" | "id">): string {
  return `${notification.project}${KEY_SEPARATOR}${notification.id}`;
}
