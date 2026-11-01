import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectWorktreeList, WorktreeInfo } from "./types";

vi.mock("./api", () => ({ fetchAllProjectWorktrees: vi.fn() }));

import { fetchAllProjectWorktrees } from "./api";
import { mergeProjectWorktrees, WorktreesStore } from "./worktrees-store.svelte";

function worktree(project: string, branch: string, overrides: Partial<WorktreeInfo> = {}): WorktreeInfo {
  return {
    project,
    branch,
    label: null,
    archived: false,
    agent: "idle",
    mux: "",
    path: `/repos/${project}/${branch}`,
    dir: null,
    dirty: false,
    unpushed: false,
    status: "idle",
    elapsed: "",
    profile: null,
    agentName: null,
    agentLabel: null,
    agentTerminalStale: false,
    services: [],
    paneCount: 0,
    prs: [],
    linearIssue: null,
    creating: false,
    creationPhase: null,
    source: "ui",
    oneshot: null,
    tabs: [],
    activeTabId: null,
    ...overrides,
  };
}

function project(prefix: string, worktrees: WorktreeInfo[], error: string | null = null): ProjectWorktreeList {
  return { prefix, name: prefix, worktrees, error };
}

describe("mergeProjectWorktrees", () => {
  it("takes successful projects as-is, in the server's order", () => {
    const merged = mergeProjectWorktrees(
      [project("alpha", [worktree("alpha", "old")])],
      [project("beta", [worktree("beta", "b")]), project("alpha", [worktree("alpha", "new")])],
    );
    expect(merged.map((p) => [p.prefix, p.worktrees.map((w) => w.branch)])).toEqual([
      ["beta", ["b"]],
      ["alpha", ["new"]],
    ]);
  });

  it("keeps a failed project's last worktrees alongside its error", () => {
    const merged = mergeProjectWorktrees(
      [project("alpha", [worktree("alpha", "main")])],
      [project("alpha", [], "boom"), project("beta", [], "down")],
    );
    expect(merged[0]).toEqual(project("alpha", [worktree("alpha", "main")], "boom"));
    expect(merged[1]).toEqual(project("beta", [], "down"));
  });
});

describe("WorktreesStore", () => {
  beforeEach(() => {
    vi.mocked(fetchAllProjectWorktrees).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("indexes a poll by project and finds worktrees by ref", async () => {
    vi.mocked(fetchAllProjectWorktrees).mockResolvedValue([
      project("alpha", [worktree("alpha", "main")]),
      project("beta", [worktree("beta", "main", { label: "beta main" })], null),
    ]);
    const onRefreshed = vi.fn();
    const store = new WorktreesStore(onRefreshed);

    await store.refresh();

    expect(store.hasLoaded("alpha")).toBe(true);
    expect(store.find({ project: "beta", branch: "main" })?.label).toBe("beta main");
    expect(store.find({ project: "gamma", branch: "main" })).toBeUndefined();
    expect(store.worktreesOf("alpha").map((w) => w.branch)).toEqual(["main"]);
    expect(store.hasProject("beta")).toBe(true);
    expect(store.nameOf("beta")).toBe("beta");
    expect(store.nameOf("gamma")).toBeNull();
    expect(onRefreshed).toHaveBeenCalledTimes(1);
  });

  it("keeps optimistic flags per project across polls", async () => {
    vi.mocked(fetchAllProjectWorktrees).mockResolvedValue([
      project("alpha", [worktree("alpha", "main")]),
      project("beta", [worktree("beta", "main")]),
    ]);
    const store = new WorktreesStore();
    await store.refresh();
    let finish!: () => void;

    const removal = store.removing.during({ project: "alpha", branch: "main" }, async () => {
      await new Promise<void>((resolve) => (finish = resolve));
      await store.refresh();
    });
    await store.refresh();

    expect(store.removing.has({ project: "alpha", branch: "main" })).toBe(true);
    expect(store.removing.has({ project: "beta", branch: "main" })).toBe(false);
    finish();
    await removal;
    expect(store.removing.has({ project: "alpha", branch: "main" })).toBe(false);
  });

  it("patches one project's worktree until the next poll replaces it", async () => {
    vi.mocked(fetchAllProjectWorktrees).mockResolvedValue([
      project("alpha", [worktree("alpha", "main")]),
      project("beta", [worktree("beta", "main")]),
    ]);
    const store = new WorktreesStore();
    await store.refresh();

    store.patch({ project: "beta", branch: "main" }, { label: "renamed" });

    expect(store.find({ project: "beta", branch: "main" })?.label).toBe("renamed");
    expect(store.find({ project: "alpha", branch: "main" })?.label).toBeNull();
    await store.refresh();
    expect(store.find({ project: "beta", branch: "main" })?.label).toBeNull();
  });

  it("surfaces a project's fetch error without dropping its worktrees", async () => {
    vi.mocked(fetchAllProjectWorktrees)
      .mockResolvedValueOnce([project("alpha", [worktree("alpha", "main")])])
      .mockResolvedValueOnce([project("alpha", [], "git failed")]);
    const store = new WorktreesStore();

    await store.refresh();
    await store.refresh();

    expect(store.errorOf("alpha")).toBe("git failed");
    expect(store.worktreesOf("alpha").map((w) => w.branch)).toEqual(["main"]);
  });

  it("counts a project as loaded only once one of its polls succeeds", async () => {
    vi.mocked(fetchAllProjectWorktrees)
      .mockResolvedValueOnce([project("alpha", [], "git failed"), project("beta", [worktree("beta", "main")])])
      .mockResolvedValueOnce([project("alpha", [worktree("alpha", "main")]), project("beta", [], "git failed")]);
    const store = new WorktreesStore();

    await store.refresh();
    expect(store.hasLoaded("alpha")).toBe(false);
    expect(store.hasLoaded("beta")).toBe(true);
    expect(store.hasLoaded("gamma")).toBe(false);

    await store.refresh();
    expect(store.hasLoaded("alpha")).toBe(true);
    expect(store.hasLoaded("beta")).toBe(true);
  });

  it("ignores a poll that resolves after a newer one", async () => {
    let resolveStale!: (lists: ProjectWorktreeList[]) => void;
    vi.mocked(fetchAllProjectWorktrees)
      .mockReturnValueOnce(new Promise((resolve) => (resolveStale = resolve)))
      .mockResolvedValueOnce([project("alpha", [worktree("alpha", "new")])]);
    const store = new WorktreesStore();

    const stale = store.refresh();
    await store.refresh();
    resolveStale([project("alpha", [worktree("alpha", "old")])]);
    await stale;

    expect(store.worktreesOf("alpha").map((w) => w.branch)).toEqual(["new"]);
  });

  it("keeps the last lists when the whole poll fails", async () => {
    vi.mocked(fetchAllProjectWorktrees)
      .mockResolvedValueOnce([project("alpha", [worktree("alpha", "main")])])
      .mockRejectedValueOnce(new Error("offline"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const store = new WorktreesStore();

    await store.refresh();
    await store.refresh();

    expect(store.worktreesOf("alpha")).toHaveLength(1);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("polls on the configured interval and stops on teardown", async () => {
    vi.useFakeTimers();
    vi.mocked(fetchAllProjectWorktrees).mockResolvedValue([]);
    const store = new WorktreesStore();

    const stop = store.startPolling();
    expect(fetchAllProjectWorktrees).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchAllProjectWorktrees).toHaveBeenCalledTimes(2);
    store.setPollInterval(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchAllProjectWorktrees).toHaveBeenCalledTimes(3);
    stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchAllProjectWorktrees).toHaveBeenCalledTimes(3);
  });
});
