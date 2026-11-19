import { pickInitialSelection, readLocationHash, writeLocationHash } from "./project-location";
import type { PendingSelection, WorktreeInfo, WorktreeRef } from "./types";
import { loadSavedSelectedWorktree, saveSelectedWorktree } from "./utils";
import { findSavedWorktree, refOf } from "./worktree-ref";

/** Branch Cmd+Up/Down moves to in `branches` (the displayed order): from
 *  nothing, the first or last one; at either end, stay put. */
export function stepBranch(branches: string[], current: string | null, direction: -1 | 1): string | null {
  if (branches.length === 0) return current;
  if (!current) return branches[direction === 1 ? 0 : branches.length - 1];
  const next = branches.indexOf(current) + direction;
  return next >= 0 && next < branches.length ? branches[next] : current;
}

/** Where the selection goes when `leaving` closes or disappears: the row
 *  above, else the one below, skipping rows being removed. */
export function neighborBranch(branches: string[], leaving: string, removing: ReadonlySet<string>): string | null {
  const index = branches.indexOf(leaving);
  const candidates = [branches[index - 1], branches[index + 1]];
  return candidates.find((branch) => branch !== undefined && !removing.has(branch)) ?? null;
}

/** The selected worktree and the current project (whose worktrees the sidebar
 *  lists). Selecting a worktree makes its project current; switching project
 *  reselects that project's saved worktree. Nothing remounts either way. The
 *  selection holds the worktree's id, so it stays on the worktree when its
 *  branch is renamed. */
export class WorktreeSelection {
  project = $state("");
  selected = $state<WorktreeRef | null>(null);
  /** A worktree named before its project's list loaded (boot hash, saved
   *  selection); `resolvePending` selects it once the list is known. */
  pending = $state<PendingSelection | null>(null);

  /** Boot selection: the hash worktree when it targets `project`, else the one
   *  saved for it. */
  constructor(project: string) {
    this.project = project;
    this.pending = pickInitialSelection(readLocationHash(), project, loadSavedSelectedWorktree(project));
  }

  /** Selected worktree id within the current project. */
  get id(): string | null {
    return this.selected?.project === this.project ? this.selected.id : null;
  }

  select(ref: WorktreeRef | null): void {
    if (ref) this.project = ref.project;
    this.selected = ref ? refOf(ref) : null;
    this.pending = null;
  }

  selectId(id: string | null): void {
    this.select(id ? { project: this.project, id } : null);
  }

  switchProject(project: string): void {
    if (project === this.project) return;
    this.project = project;
    this.selected = null;
    this.pending = pickInitialSelection(null, project, loadSavedSelectedWorktree(project));
  }

  /** Select the pending worktree among the current project's loaded list
   *  (nothing when it is gone): the hash names a branch, the saved selection
   *  an id or, saved by older versions, a branch. */
  resolvePending(worktrees: Array<Pick<WorktreeInfo, "project" | "id" | "branch">>): void {
    const pending = this.pending;
    if (!pending) return;
    const match = pending.source === "hash"
      ? worktrees.find((worktree) => worktree.branch === pending.name)
      : findSavedWorktree(worktrees, pending.name);
    this.select(match ?? null);
  }

  /** Mirror the selection into storage (its id) and the hash (its current
   *  branch). Once the project's list is known, a resolved worktree is saved,
   *  and an empty list clears it. */
  persist(selectedWorktree: Pick<WorktreeInfo, "id" | "branch"> | undefined, loaded: boolean, hasSelectable: boolean): void {
    const pendingBranch = this.pending?.source === "hash" ? this.pending.name : null;
    writeLocationHash(this.project, selectedWorktree?.branch ?? pendingBranch);
    if (!loaded) return;
    if (selectedWorktree) saveSelectedWorktree(this.project, selectedWorktree.id);
    else if (!hasSelectable) saveSelectedWorktree(this.project, null);
  }
}
