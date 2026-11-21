import type { AppNotification, WorktreeRef } from "./types";

/** Project prefixes are `[a-z0-9-]` slugs, so the first `:` always splits a
 *  key back into its project and worktree id. */
const KEY_SEPARATOR = ":";

/** Stable string identity of a worktree across projects (Set/Map/storage key,
 *  row identity): the runtime worktree id, not the branch. */
export function worktreeKey(ref: WorktreeRef): string {
  return `${ref.project}${KEY_SEPARATOR}${ref.id}`;
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

export function notificationWorktree(notification: Pick<AppNotification, "project" | "worktreeId">): WorktreeRef {
  return { project: notification.project, id: notification.worktreeId };
}

/** Notification ids are only unique per project. */
export function notificationKey(notification: Pick<AppNotification, "project" | "id">): string {
  return `${notification.project}${KEY_SEPARATOR}${notification.id}`;
}
