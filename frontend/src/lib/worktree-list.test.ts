import { describe, expect, it } from "vitest";
import {
  buildProjectListRows,
  buildWorktreeListRows,
  countAgentStatusesIn,
  keysWithAgentStatus,
  matchesWorktreeSearch,
  sortFavoritesFirst,
} from "./worktree-list";
import type { WorktreeInfo, WorktreeListRow } from "./types";

function createWorktree(branch: string, overrides: Partial<WorktreeInfo> = {}): WorktreeInfo {
  return {
    project: "webmux",
    id: `wt-${branch}`,
    branch,
    label: null,
    archived: false,
    agent: "waiting",
    mux: "",
    path: `/repo/__worktrees/${branch}`,
    dir: `/repo/__worktrees/${branch}`,
    dirty: false,
    unpushed: false,
    status: "idle",
    elapsed: "",
    profile: null,
    agentName: null,
    agentLabel: null,
    agentTerminalStale: false,
    services: [],
    paneCount: 1,
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

describe("buildWorktreeListRows", () => {
  it("nests child worktrees under their base worktree when it exists", () => {
    const rows = buildWorktreeListRows([
      createWorktree("feature/base"),
      createWorktree("feature/child-a", { baseBranch: "feature/base" }),
      createWorktree("feature/grandchild", { baseBranch: "feature/child-a" }),
      createWorktree("feature/child-b", { baseBranch: "feature/base" }),
    ]);

    expect(rows.map((row) => [row.worktree.branch, row.depth])).toEqual([
      ["feature/base", 0],
      ["feature/child-a", 1],
      ["feature/grandchild", 2],
      ["feature/child-b", 1],
    ]);
  });

  it("keeps a worktree at the top level when its base worktree is not visible", () => {
    const rows = buildWorktreeListRows([
      createWorktree("feature/child", { baseBranch: "feature/missing-base" }),
      createWorktree("feature/other"),
    ]);

    expect(rows.map((row) => [row.worktree.branch, row.depth])).toEqual([
      ["feature/child", 0],
      ["feature/other", 0],
    ]);
  });

  it("matches label and profile text when searching worktrees", () => {
    expect(matchesWorktreeSearch(createWorktree("feature/random-fallback", { label: "Search ranking" }), "ranking")).toBe(true);
    expect(matchesWorktreeSearch(createWorktree("feature/active", { profile: "sandbox" }), "sand")).toBe(true);
    expect(matchesWorktreeSearch(createWorktree("feature/other"), "ranking")).toBe(false);
  });
});

function createRow(branch: string, overrides: Partial<WorktreeInfo> = {}): WorktreeListRow {
  return { worktree: createWorktree(branch, { mux: "✓", ...overrides }), depth: 0 };
}

describe("sortFavoritesFirst", () => {
  it("moves favorites to the top while keeping relative order", () => {
    const sorted = sortFavoritesFirst(
      [createWorktree("a"), createWorktree("b"), createWorktree("c"), createWorktree("d")],
      new Set(["webmux:d", "webmux:b"]),
    );

    expect(sorted.map((worktree) => worktree.branch)).toEqual(["b", "d", "a", "c"]);
  });

  it("moves a favorite root together with its sub-worktrees", () => {
    const rows = buildWorktreeListRows(
      sortFavoritesFirst(
        [
          createWorktree("other"),
          createWorktree("fav"),
          createWorktree("fav-child", { baseBranch: "fav" }),
        ],
        new Set(["webmux:fav"]),
      ),
    );

    expect(rows.map((row) => [row.worktree.branch, row.depth])).toEqual([
      ["fav", 0],
      ["fav-child", 1],
      ["other", 0],
    ]);
  });
});

describe("countAgentStatusesIn", () => {
  const rows = [
    createRow("a", { agent: "waiting" }),
    createRow("b", { agent: "error" }),
    createRow("c", { agent: "waiting" }),
    createRow("d", { agent: "working" }),
    createRow("e", { agent: "idle" }),
  ];

  it("counts waiting and error rows within the given key set", () => {
    expect(countAgentStatusesIn(rows, new Set(["webmux:b", "webmux:c"]))).toEqual({
      waiting: 1,
      error: 1,
      "done-unread": 0,
    });
  });

  it("counts every row when no key set is given", () => {
    expect(countAgentStatusesIn(rows)).toEqual({ waiting: 2, error: 1, "done-unread": 0 });
  });

  it("returns zero counts for an empty set", () => {
    expect(countAgentStatusesIn(rows, new Set())).toEqual({ waiting: 0, error: 0, "done-unread": 0 });
  });

  it("ignores working and idle rows even when in the set", () => {
    expect(countAgentStatusesIn(rows, new Set(["webmux:d", "webmux:e"]))).toEqual({
      waiting: 0,
      error: 0,
      "done-unread": 0,
    });
  });

  it("does not count rows whose agent icon would be hidden (closed or creating)", () => {
    const closedRows = [
      createRow("closed", { agent: "waiting", mux: "" }),
      createRow("creating", { agent: "error", creating: true }),
      createRow("live", { agent: "waiting" }),
    ];
    expect(countAgentStatusesIn(closedRows, new Set(["webmux:closed", "webmux:creating", "webmux:live"]))).toEqual({
      waiting: 1,
      error: 0,
      "done-unread": 0,
    });
  });

  it("counts done rows only when they are unread", () => {
    const doneRows = [
      createRow("seen", { agent: "done" }),
      createRow("unseen-a", { agent: "done" }),
      createRow("unseen-b", { agent: "done" }),
    ];
    const keys = new Set(["webmux:seen", "webmux:unseen-a", "webmux:unseen-b"]);
    const notified = new Set(["webmux:unseen-a", "webmux:unseen-b"]);
    expect(countAgentStatusesIn(doneRows, keys, notified)).toEqual({
      waiting: 0,
      error: 0,
      "done-unread": 2,
    });
  });
});

describe("keysWithAgentStatus", () => {
  const rows = [
    createRow("first", { agent: "waiting" }),
    createRow("closed", { agent: "waiting", mux: "" }),
    createRow("err", { agent: "error" }),
    createRow("second", { agent: "waiting" }),
  ];

  it("returns matching keys in list order, skipping hidden-icon rows", () => {
    expect(keysWithAgentStatus(rows, "waiting")).toEqual(["webmux:first", "webmux:second"]);
    expect(keysWithAgentStatus(rows, "error")).toEqual(["webmux:err"]);
  });

  it("restricts matches to the given key set when provided", () => {
    expect(keysWithAgentStatus(rows, "waiting", new Set(["webmux:second"]))).toEqual(["webmux:second"]);
  });
});

function branchesOf(rows: WorktreeListRow[]): Array<[string, number]> {
  return rows.map((row) => [row.worktree.branch, row.depth]);
}

describe("buildProjectListRows", () => {
  const worktrees = [
    createWorktree("main"),
    createWorktree("feat/search"),
    createWorktree("feat/search-child", { baseBranch: "feat/search" }),
    createWorktree("old", { archived: true }),
    createWorktree("old-child", { archived: true, baseBranch: "old" }),
  ];

  it("splits active and archived rows, each nesting its own sub-worktrees", () => {
    const rows = buildProjectListRows(worktrees, { query: "", favorites: new Set() });

    expect(branchesOf(rows.active)).toEqual([["main", 0], ["feat/search", 0], ["feat/search-child", 1]]);
    expect(branchesOf(rows.archived)).toEqual([["old", 0], ["old-child", 1]]);
  });

  it("filters both groups by the search", () => {
    const rows = buildProjectListRows(worktrees, { query: "old", favorites: new Set() });

    expect(rows.active).toEqual([]);
    expect(branchesOf(rows.archived)).toEqual([["old", 0], ["old-child", 1]]);
  });

  it("lists favorites first, keyed by project", () => {
    const rows = buildProjectListRows(worktrees, { query: "", favorites: new Set(["webmux:feat/search", "other:main"]) });

    expect(branchesOf(rows.active)).toEqual([["feat/search", 0], ["feat/search-child", 1], ["main", 0]]);
  });
});
