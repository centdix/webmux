import type { ActiveListRow, PendingCreationInfo, ProjectListRows, WorktreeInfo, WorktreeListRow } from "./types";
import { searchMatch } from "./utils";
import { worktreeKey, worktreeRowKey } from "./worktree-ref";

function parentBranchOf(worktree: WorktreeInfo, worktreesByBranch: Map<string, WorktreeInfo>): string | null {
  if (!worktree.baseBranch || worktree.baseBranch === worktree.branch) {
    return null;
  }

  return worktreesByBranch.has(worktree.baseBranch) ? worktree.baseBranch : null;
}

export function matchesWorktreeSearch(worktree: WorktreeInfo, query: string): boolean {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return true;

  return [
    worktree.label ?? "",
    worktree.branch,
    worktree.baseBranch ?? "",
    worktree.profile ?? "",
    worktree.agentLabel ?? "",
    worktree.agentName ?? "",
    worktree.linearIssue?.identifier ?? "",
  ].some((value) => searchMatch(trimmedQuery, value));
}

export const OVERFLOW_STATUS_BAR_STATUSES = ["waiting", "error", "done-unread"] as const;
export type OverflowStatusBarStatus = (typeof OVERFLOW_STATUS_BAR_STATUSES)[number];

export const OVERFLOW_STATUS_LABELS: Record<OverflowStatusBarStatus, string> = {
  waiting: "waiting",
  error: "error",
  "done-unread": "unread",
};

export function rowShowsAgentStatus(worktree: WorktreeInfo): boolean {
  return worktree.mux === "✓" && !worktree.creating;
}

// The countable mark a row contributes to the overflow bars, mirroring the per-row
// indicator: waiting, error, or a done run that hasn't been viewed yet (the blue dot).
// Sets below hold `worktreeKey`s, so rows of every project can share them.
export function overflowStatusOf(
  worktree: WorktreeInfo,
  notifiedKeys: ReadonlySet<string>,
): OverflowStatusBarStatus | null {
  if (!rowShowsAgentStatus(worktree)) return null;
  if (worktree.agent === "waiting") return "waiting";
  if (worktree.agent === "error") return "error";
  if (worktree.agent === "done" && notifiedKeys.has(worktreeKey(worktree))) return "done-unread";
  return null;
}

export function countAgentStatusesIn(
  rows: WorktreeListRow[],
  keys?: ReadonlySet<string>,
  notifiedKeys: ReadonlySet<string> = new Set(),
): Record<OverflowStatusBarStatus, number> {
  const counts: Record<OverflowStatusBarStatus, number> = { waiting: 0, error: 0, "done-unread": 0 };
  for (const { worktree } of rows) {
    if (keys && !keys.has(worktreeKey(worktree))) continue;
    const status = overflowStatusOf(worktree, notifiedKeys);
    if (status) counts[status]++;
  }
  return counts;
}

export function keysWithAgentStatus(
  rows: WorktreeListRow[],
  status: OverflowStatusBarStatus,
  keys?: ReadonlySet<string>,
  notifiedKeys: ReadonlySet<string> = new Set(),
): string[] {
  return rows
    .map(({ worktree }) => ({ worktree, key: worktreeKey(worktree) }))
    .filter(({ worktree, key }) => overflowStatusOf(worktree, notifiedKeys) === status && (!keys || keys.has(key)))
    .map(({ key }) => key);
}

export function sortFavoritesFirst(worktrees: WorktreeInfo[], favorites: ReadonlySet<string>): WorktreeInfo[] {
  return [
    ...worktrees.filter((worktree) => favorites.has(worktreeKey(worktree))),
    ...worktrees.filter((worktree) => !favorites.has(worktreeKey(worktree))),
  ];
}

/** The current project's rows: those matching the search, favorites first,
 *  split into active and archived (each nesting its own sub-worktrees).
 *  Creations still naming their branch always show, right after the favorites:
 *  where their worktree lands once named, as creating rows sort first. */
export function buildProjectListRows(
  worktrees: WorktreeInfo[],
  pendingCreations: PendingCreationInfo[],
  options: { query: string; favorites: ReadonlySet<string> },
): ProjectListRows {
  const matching = sortFavoritesFirst(
    worktrees.filter((worktree) => matchesWorktreeSearch(worktree, options.query)),
    options.favorites,
  );
  const active = buildWorktreeListRows(matching.filter((worktree) => !worktree.archived));
  const firstNonFavorite = active.findIndex(
    (row) => row.depth === 0 && !options.favorites.has(worktreeKey(row.worktree)),
  );
  const pendingAt = firstNonFavorite === -1 ? active.length : firstNonFavorite;
  return {
    active: [
      ...active.slice(0, pendingAt),
      ...pendingCreations.map((pending): ActiveListRow => ({ pending, depth: 0 })),
      ...active.slice(pendingAt),
    ],
    archived: buildWorktreeListRows(matching.filter((worktree) => worktree.archived)),
  };
}

/** A row's `{#each}` key: its worktree id, which a pending creation already
 *  has, so the row keeps its element once the worktree exists. */
export function listRowKey(row: ActiveListRow): string {
  return worktreeRowKey("pending" in row ? row.pending : row.worktree);
}

/** The rows that are worktrees, leaving out creations still naming their branch. */
export function worktreeRowsOf(rows: ActiveListRow[]): WorktreeListRow[] {
  return rows.filter((row): row is WorktreeListRow => "worktree" in row);
}

export function buildWorktreeListRows(worktrees: WorktreeInfo[]): WorktreeListRow[] {
  const worktreesByBranch = new Map(worktrees.map((worktree) => [worktree.branch, worktree]));
  const childrenByParent = new Map<string, WorktreeInfo[]>();
  const roots: WorktreeInfo[] = [];

  for (const worktree of worktrees) {
    const parentBranch = parentBranchOf(worktree, worktreesByBranch);
    if (!parentBranch) {
      roots.push(worktree);
      continue;
    }

    const siblings = childrenByParent.get(parentBranch) ?? [];
    siblings.push(worktree);
    childrenByParent.set(parentBranch, siblings);
  }

  const rows: WorktreeListRow[] = [];
  const visited = new Set<string>();

  function append(worktree: WorktreeInfo, depth: number): void {
    if (visited.has(worktree.branch)) return;
    visited.add(worktree.branch);
    rows.push({ worktree, depth });

    for (const child of childrenByParent.get(worktree.branch) ?? []) {
      append(child, depth + 1);
    }
  }

  for (const root of roots) {
    append(root, 0);
  }

  for (const worktree of worktrees) {
    append(worktree, 0);
  }

  return rows;
}
