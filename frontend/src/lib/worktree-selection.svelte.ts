import { pickInitialBranch, readLocationHash, writeLocationHash } from "./project-location";
import type { WorktreeInfo, WorktreeRef } from "./types";
import { loadSavedSelectedWorktree, saveSelectedWorktree } from "./utils";

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
 *  reselects that project's saved worktree. Nothing remounts either way. */
export class WorktreeSelection {
  project = $state("");
  selected = $state<WorktreeRef | null>(null);

  /** Boot selection: the hash worktree when it targets `project`, else the one
   *  saved for it. */
  constructor(project: string) {
    this.project = project;
    this.selected = this.#refIn(project, pickInitialBranch(readLocationHash(), project, loadSavedSelectedWorktree(project)));
  }

  /** Selected branch within the current project. */
  get branch(): string | null {
    return this.selected?.project === this.project ? this.selected.branch : null;
  }

  select(ref: WorktreeRef | null): void {
    if (ref) this.project = ref.project;
    this.selected = ref;
  }

  selectBranch(branch: string | null): void {
    this.selected = this.#refIn(this.project, branch);
  }

  switchProject(project: string): void {
    if (project === this.project) return;
    this.project = project;
    this.selected = this.#refIn(project, loadSavedSelectedWorktree(project));
  }

  /** Mirror the selection into storage and the hash. Once the project's list
   *  is known, a resolved worktree is saved, and an empty list clears it. */
  persist(selectedWorktree: WorktreeInfo | undefined, loaded: boolean, hasSelectable: boolean): void {
    writeLocationHash(this.project, this.branch);
    if (!loaded) return;
    if (selectedWorktree) saveSelectedWorktree(this.project, selectedWorktree.branch);
    else if (!hasSelectable) saveSelectedWorktree(this.project, null);
  }

  #refIn(project: string, branch: string | null): WorktreeRef | null {
    return branch ? { project, branch } : null;
  }
}
