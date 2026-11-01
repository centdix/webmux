import {
  createWorktreeTab,
  deleteWorktreeTab,
  postWorktreeToLinear,
  projectApi,
  refreshWorktreeAgentTerminal,
  selectWorktreeTab,
  setWorktreeLabel,
  setWorktreeProfile,
} from "./api";
import type { PostWorktreeToLinearResponse, PostWorktreeToLinearTarget, ToastInput, WorktreeRef } from "./types";
import { errorMessage } from "./utils";
import { worktreeKey } from "./worktree-ref";
import type { WorktreesStore } from "./worktrees-store.svelte";

export interface WorktreeActionsDeps {
  store: WorktreesStore;
  toast: (toast: ToastInput) => void;
  /** Move the selection off `ref` before it closes or goes away. */
  leave: (ref: WorktreeRef) => void;
  /** The set of branches changed (create/remove): drop cached branch lists. */
  onBranchesChanged: () => void;
}

/** What the dashboard does to one worktree of any project: each action calls
 *  the worktree's own project, raises its optimistic flag in the store, then
 *  refreshes. */
export class WorktreeActions {
  tabBusy = $state(false);
  /** Bumped per worktree to reconnect its terminal after a session restart. */
  terminalRevisions = $state<Record<string, number>>({});
  readonly #deps: WorktreeActionsDeps;

  constructor(deps: WorktreeActionsDeps) {
    this.#deps = deps;
  }

  terminalKey(ref: WorktreeRef): string {
    const key = worktreeKey(ref);
    return `${key}:${this.terminalRevisions[key] ?? 0}`;
  }

  /** Forget revisions of worktrees that no longer exist. */
  pruneTerminalRevisions(present: ReadonlySet<string>): void {
    const entries = Object.entries(this.terminalRevisions).filter(([key]) => present.has(key));
    if (entries.length !== Object.keys(this.terminalRevisions).length) {
      this.terminalRevisions = Object.fromEntries(entries);
    }
  }

  async open(ref: WorktreeRef): Promise<void> {
    await this.#deps.store.opening.during(ref, async () => {
      try {
        await projectApi(ref.project).openWorktree({ params: { name: ref.branch }, body: {} });
        await this.#deps.store.refresh();
      } catch (err) {
        this.#deps.toast({ tone: "error", message: `Failed to open worktree: ${errorMessage(err)}` });
      }
    });
  }

  async close(ref: WorktreeRef): Promise<void> {
    this.#deps.leave(ref);
    try {
      await projectApi(ref.project).closeWorktree({ params: { name: ref.branch } });
      await this.#deps.store.refresh();
    } catch (err) {
      this.#deps.toast({ tone: "error", message: `Failed to close worktree: ${errorMessage(err)}` });
    }
  }

  async toggleArchived(ref: WorktreeRef): Promise<void> {
    const worktree = this.#deps.store.find(ref);
    if (!worktree || worktree.creating) return;
    const archived = !worktree.archived;
    await this.#deps.store.archiving.during(ref, async () => {
      try {
        await projectApi(ref.project).setWorktreeArchived({ params: { name: ref.branch }, body: { archived } });
        await this.#deps.store.refresh();
      } catch (err) {
        alert(`Failed to ${archived ? "archive" : "restore"} worktree: ${errorMessage(err)}`);
      }
    });
  }

  async remove(ref: WorktreeRef): Promise<void> {
    this.#deps.leave(ref);
    await this.#deps.store.removing.during(ref, async () => {
      try {
        await projectApi(ref.project).removeWorktree({ params: { name: ref.branch } });
        this.#deps.onBranchesChanged();
        await this.#deps.store.refresh();
      } catch (err) {
        this.#deps.toast({ tone: "error", message: `Failed to remove: ${errorMessage(err)}` });
      }
    });
  }

  /** Throws so the label dialog can show the error. */
  async setLabel(ref: WorktreeRef, label: string | null): Promise<void> {
    const next = await setWorktreeLabel(ref.project, ref.branch, label);
    this.#deps.store.patch(ref, { label: next });
  }

  /** Throws so the profile dialog can show the error. */
  async setProfile(ref: WorktreeRef, profile: string): Promise<void> {
    const result = await setWorktreeProfile(ref.project, ref.branch, profile);
    await this.#deps.store.refresh();
    if (result.restarted) this.#bumpTerminal(ref);
    this.#deps.toast({
      tone: "success",
      message: result.restarted
        ? `Switched ${ref.branch} to the "${result.profile}" profile`
        : `Switched ${ref.branch} to the "${result.profile}" profile — applies on next open`,
    });
  }

  async refreshAgentTerminal(ref: WorktreeRef): Promise<void> {
    if (this.#deps.store.refreshingAgentTerminal.has(ref)) return;
    await this.#deps.store.refreshingAgentTerminal.during(ref, async () => {
      try {
        await refreshWorktreeAgentTerminal(ref.project, ref.branch);
        await this.#deps.store.refresh();
        this.#bumpTerminal(ref);
        this.#deps.toast({ tone: "success", message: "Agent terminal refreshed" });
      } catch (err) {
        this.#deps.toast({ tone: "error", message: `Failed to refresh terminal: ${errorMessage(err)}` });
      }
    });
  }

  createTab(ref: WorktreeRef): Promise<void> {
    return this.#tabAction("create tab", () => createWorktreeTab(ref.project, ref.branch));
  }

  selectTab(ref: WorktreeRef, tabId: string): Promise<void> {
    return this.#tabAction("switch tab", () => selectWorktreeTab(ref.project, ref.branch, tabId));
  }

  deleteTab(ref: WorktreeRef, tabId: string): Promise<void> {
    return this.#tabAction("delete tab", () => deleteWorktreeTab(ref.project, ref.branch, tabId));
  }

  /** Throws so the Linear post dialog can show the error. */
  async postToLinear(ref: WorktreeRef, target: PostWorktreeToLinearTarget): Promise<PostWorktreeToLinearResponse> {
    const response = await postWorktreeToLinear(ref.project, ref.branch, target);
    this.#deps.toast({ tone: "success", message: `Posted to Linear: ${response.issueUrl}` });
    return response;
  }

  async postToLinkedIssue(ref: WorktreeRef, issueId: string): Promise<void> {
    await this.#deps.store.postingLinear.during(ref, async () => {
      try {
        await this.postToLinear(ref, { kind: "issue", issueId });
      } catch (err) {
        this.#deps.toast({ tone: "error", message: `Failed to post to Linear: ${errorMessage(err)}` });
      }
    });
  }

  #bumpTerminal(ref: WorktreeRef): void {
    const key = worktreeKey(ref);
    this.terminalRevisions = { ...this.terminalRevisions, [key]: (this.terminalRevisions[key] ?? 0) + 1 };
  }

  async #tabAction(label: string, run: () => Promise<unknown>): Promise<void> {
    if (this.tabBusy) return;
    this.tabBusy = true;
    try {
      await run();
      await this.#deps.store.refresh();
    } catch (err) {
      this.#deps.toast({ tone: "error", message: `Failed to ${label}: ${errorMessage(err)}` });
    } finally {
      this.tabBusy = false;
    }
  }
}
