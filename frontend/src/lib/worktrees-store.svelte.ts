import { SvelteSet } from "svelte/reactivity";
import { fetchAllProjectWorktrees } from "./api";
import type { PendingCreationInfo, ProjectWorktreeList, WorktreeInfo, WorktreeRef } from "./types";
import { worktreeKey } from "./worktree-ref";

export const DEFAULT_POLL_INTERVAL_MS = 5000;
export const ACTIVE_CREATE_POLL_INTERVAL_MS = 1000;
const IDLE_TIMEOUT_MS = 60_000;

/** Merge a poll into the previous lists: a project whose fetch failed keeps its
 *  last known worktrees and pending creations (alongside the error), so a
 *  transient failure neither empties its list nor drops its selection. */
export function mergeProjectWorktrees(
  previous: ProjectWorktreeList[],
  next: ProjectWorktreeList[],
): ProjectWorktreeList[] {
  const previousByPrefix = new Map(previous.map((project) => [project.prefix, project]));
  return next.map((project) =>
    project.error === null
      ? project
      : {
          ...project,
          worktrees: previousByPrefix.get(project.prefix)?.worktrees ?? [],
          pendingCreations: previousByPrefix.get(project.prefix)?.pendingCreations ?? [],
        }
  );
}

/** An optimistic per-worktree flag (removing, opening, archiving…), keyed by
 *  `worktreeKey` so equal branch names in two projects never share it. */
export class WorktreeFlags {
  readonly keys = new SvelteSet<string>();

  has(ref: WorktreeRef): boolean {
    return this.keys.has(worktreeKey(ref));
  }

  /** Raise the flag for the duration of `task`. */
  async during<T>(ref: WorktreeRef, task: () => Promise<T>): Promise<T> {
    const key = worktreeKey(ref);
    this.keys.add(key);
    try {
      return await task();
    } finally {
      this.keys.delete(key);
    }
  }
}

/** Worktrees of every project, fed by one poll of the hub listing. */
export class WorktreesStore {
  projects = $state<ProjectWorktreeList[]>([]);
  /** Prefixes with at least one successful listing. */
  readonly #loaded = new SvelteSet<string>();
  readonly removing = new WorktreeFlags();
  readonly opening = new WorktreeFlags();
  readonly archiving = new WorktreeFlags();
  readonly postingLinear = new WorktreeFlags();
  readonly refreshingAgentTerminal = new WorktreeFlags();
  readonly hasCreating = $derived(
    this.projects.some((project) => project.pendingCreations.length > 0 || project.worktrees.some((w) => w.creating)),
  );

  readonly #onRefreshed: () => void;
  readonly #focus: () => string | undefined;
  #intervalMs = DEFAULT_POLL_INTERVAL_MS;
  #restartInterval: (() => void) | null = null;
  #lastRequest = 0;
  #lastApplied = 0;

  /** `onRefreshed` runs after every refresh, polled or explicit. `focus` is
   *  the project being shown, reported with every poll. */
  constructor(onRefreshed: () => void = () => {}, focus: () => string | undefined = () => undefined) {
    this.#onRefreshed = onRefreshed;
    this.#focus = focus;
  }

  /** The project's list is known: one of its polls succeeded. Until then an
   *  empty list means "not loaded", not "no worktrees". */
  hasLoaded(project: string): boolean {
    return this.#loaded.has(project);
  }

  nameOf(project: string): string | null {
    return this.projects.find((entry) => entry.prefix === project)?.name ?? null;
  }

  worktreesOf(project: string): WorktreeInfo[] {
    return this.projects.find((entry) => entry.prefix === project)?.worktrees ?? [];
  }

  pendingCreationsOf(project: string): PendingCreationInfo[] {
    return this.projects.find((entry) => entry.prefix === project)?.pendingCreations ?? [];
  }

  errorOf(project: string): string | null {
    return this.projects.find((entry) => entry.prefix === project)?.error ?? null;
  }

  find(ref: WorktreeRef): WorktreeInfo | undefined {
    return this.worktreesOf(ref.project).find((worktree) => worktree.branch === ref.branch);
  }

  async refresh(): Promise<void> {
    const request = ++this.#lastRequest;
    try {
      const lists = await fetchAllProjectWorktrees(this.#focus());
      // A slower, older poll must not overwrite a newer one.
      if (request > this.#lastApplied) {
        this.#lastApplied = request;
        this.projects = mergeProjectWorktrees(this.projects, lists);
        for (const entry of lists) if (entry.error === null) this.#loaded.add(entry.prefix);
      }
    } catch (err) {
      console.error("Failed to refresh:", err);
    }
    this.#onRefreshed();
  }

  /** Forget a removed project now instead of on the next poll. */
  drop(project: string): void {
    this.projects = this.projects.filter((entry) => entry.prefix !== project);
    this.#loaded.delete(project);
  }

  /** Apply a confirmed change locally until the next poll reports it. */
  patch(ref: WorktreeRef, fields: Partial<Omit<WorktreeInfo, keyof WorktreeRef>>): void {
    this.projects = this.projects.map((project) =>
      project.prefix !== ref.project
        ? project
        : {
            ...project,
            worktrees: project.worktrees.map((worktree) =>
              worktree.branch === ref.branch ? { ...worktree, ...fields } : worktree
            ),
          }
    );
  }

  setPollInterval(intervalMs: number): void {
    if (this.#intervalMs === intervalMs) return;
    this.#intervalMs = intervalMs;
    this.#restartInterval?.();
  }

  /** Refresh now, then poll; pauses while the tab is hidden or idle (no
   *  interaction for a minute). Returns the teardown. */
  startPolling(): () => void {
    let interval: ReturnType<typeof setInterval> | undefined;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let idle = false;

    const startInterval = (): void => {
      if (interval) clearInterval(interval);
      if (document.hidden || idle) return;
      interval = setInterval(() => void this.refresh(), this.#intervalMs);
    };

    const resetIdleTimer = (): void => {
      if (idle) {
        idle = false;
        void this.refresh();
        startInterval();
      }
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        idle = true;
        if (interval) clearInterval(interval);
      }, IDLE_TIMEOUT_MS);
    };

    const onVisibilityChange = (): void => {
      if (document.hidden) {
        if (interval) clearInterval(interval);
      } else {
        resetIdleTimer();
        void this.refresh();
        startInterval();
      }
    };

    this.#restartInterval = startInterval;
    void this.refresh();
    startInterval();
    document.addEventListener("click", resetIdleTimer);
    document.addEventListener("keydown", resetIdleTimer);
    document.addEventListener("visibilitychange", onVisibilityChange);
    resetIdleTimer();

    return () => {
      if (interval) clearInterval(interval);
      clearTimeout(idleTimer);
      this.#restartInterval = null;
      document.removeEventListener("click", resetIdleTimer);
      document.removeEventListener("keydown", resetIdleTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }
}
