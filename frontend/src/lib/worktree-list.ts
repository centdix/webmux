import type { ProjectWorktreeList, WorktreeInfo, WorktreeListRow, WorktreeListSection, WorktreeRef } from "./types";
import { searchMatch } from "./utils";
import { worktreeKey } from "./worktree-ref";

export interface FilterWorktreesOptions {
  query: string;
  showArchived: boolean;
}

export interface WorktreeListSectionsOptions extends FilterWorktreesOptions {
  /** Favorite worktree keys, listed first within their project. */
  favorites: ReadonlySet<string>;
  /** Prefixes of the collapsed projects. */
  collapsed: ReadonlySet<string>;
}

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

export function filterWorktrees(worktrees: WorktreeInfo[], options: FilterWorktreesOptions): WorktreeInfo[] {
  return worktrees.filter((worktree) =>
    (options.showArchived || !worktree.archived) && matchesWorktreeSearch(worktree, options.query)
  );
}

export function countArchivedMatches(worktrees: WorktreeInfo[], query: string): number {
  return worktrees.filter((worktree) => worktree.archived && matchesWorktreeSearch(worktree, query)).length;
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

function emptySectionMessage(project: ProjectWorktreeList, showArchived: boolean): string | null {
  if (project.error !== null) return null;
  return !showArchived && project.worktrees.some((worktree) => worktree.archived)
    ? "No active worktrees."
    : "No worktrees found.";
}

/** The sidebar: every project in the given (server) order, each with its
 *  filtered rows. While searching, a project without a match is left out
 *  unless its fetch failed (the error stays visible). */
export function buildWorktreeListSections(
  projects: ProjectWorktreeList[],
  options: WorktreeListSectionsOptions,
): WorktreeListSection[] {
  const searching = options.query.trim() !== "";
  return projects.flatMap((project) => {
    const visible = filterWorktrees(project.worktrees, options);
    if (searching && visible.length === 0 && project.error === null) return [];
    return [{
      prefix: project.prefix,
      name: project.name,
      error: project.error,
      collapsed: options.collapsed.has(project.prefix),
      rows: buildWorktreeListRows(sortFavoritesFirst(visible, options.favorites)),
      emptyMessage: visible.length === 0 ? emptySectionMessage(project, options.showArchived) : null,
    }];
  });
}

/** Rows on screen, top to bottom across projects (collapsed ones contribute
 *  none): the order keyboard navigation and neighbor selection follow. */
export function displayedWorktrees(sections: WorktreeListSection[]): WorktreeInfo[] {
  return sections.flatMap((section) => (section.collapsed ? [] : section.rows.map((row) => row.worktree)));
}

/** Keys Cmd+Up/Down and neighbor selection step through: the displayed rows,
 *  plus `selected` at its project's place when its row is hidden (collapsed
 *  project), so stepping from it reaches the visible rows around that project. */
export function navigationKeys(sections: WorktreeListSection[], selected: WorktreeRef | null): string[] {
  const keys = displayedWorktrees(sections).map(worktreeKey);
  if (!selected) return keys;
  const selectedKey = worktreeKey(selected);
  if (keys.includes(selectedKey)) return keys;
  let index = 0;
  for (const section of sections) {
    if (section.prefix === selected.project) {
      keys.splice(index, 0, selectedKey);
      break;
    }
    if (!section.collapsed) index += section.rows.length;
  }
  return keys;
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
