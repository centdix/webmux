import { describe, expect, it } from "vitest";
import {
  buildWorktreeListRows,
  buildWorktreeListSections,
  countAgentStatusesIn,
  countArchivedMatches,
  displayedWorktrees,
  filterWorktrees,
  keysWithAgentStatus,
  sortFavoritesFirst,
  type WorktreeListSectionsOptions,
} from "./worktree-list";
import type { ProjectWorktreeList, WorktreeInfo, WorktreeListRow } from "./types";

function createWorktree(branch: string, overrides: Partial<WorktreeInfo> = {}): WorktreeInfo {
  return {
    project: "webmux",
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

  it("filters archived worktrees out by default and matches profile text", () => {
    const worktrees = filterWorktrees([
      createWorktree("feature/active", { profile: "sandbox" }),
      createWorktree("feature/archived", { archived: true, profile: "default" }),
    ], {
      query: "sand",
      showArchived: false,
    });

    expect(worktrees.map((worktree) => worktree.branch)).toEqual(["feature/active"]);
  });

  it("matches label text when searching worktrees", () => {
    const worktrees = filterWorktrees([
      createWorktree("feature/random-fallback", { label: "Search ranking" }),
      createWorktree("feature/other"),
    ], {
      query: "ranking",
      showArchived: false,
    });

    expect(worktrees.map((worktree) => worktree.branch)).toEqual(["feature/random-fallback"]);
  });

  it("counts archived matches separately from visible rows", () => {
    const count = countArchivedMatches([
      createWorktree("feature/alpha", { archived: true }),
      createWorktree("feature/beta", { archived: true }),
      createWorktree("feature/gamma"),
    ], "beta");

    expect(count).toBe(1);
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

function createProject(prefix: string, worktrees: WorktreeInfo[], error: string | null = null): ProjectWorktreeList {
  return { prefix, name: prefix.toUpperCase(), worktrees, error };
}

function sectionOptions(overrides: Partial<WorktreeListSectionsOptions> = {}): WorktreeListSectionsOptions {
  return { query: "", showArchived: false, favorites: new Set(), collapsed: new Set(), ...overrides };
}

describe("buildWorktreeListSections", () => {
  const projects = [
    createProject("beta", [createWorktree("main", { project: "beta" }), createWorktree("feat/search", { project: "beta" })]),
    createProject("alpha", [createWorktree("main", { project: "alpha" })]),
    createProject("gamma", [createWorktree("old", { project: "gamma", archived: true })]),
  ];

  it("keeps every project in the given order with its header data", () => {
    const sections = buildWorktreeListSections(projects, sectionOptions());

    expect(sections.map((section) => [section.prefix, section.name, section.rows.length])).toEqual([
      ["beta", "BETA", 2],
      ["alpha", "ALPHA", 1],
      ["gamma", "GAMMA", 0],
    ]);
    expect(sections[2]?.emptyMessage).toBe("No active worktrees.");
    expect(sections[0]?.emptyMessage).toBeNull();
  });

  it("sorts favorites first within each project, keyed by project", () => {
    const sections = buildWorktreeListSections(projects, sectionOptions({ favorites: new Set(["beta:feat/search", "alpha:x"]) }));

    expect(sections[0]?.rows.map((row) => row.worktree.branch)).toEqual(["feat/search", "main"]);
  });

  it("drops the projects without a match while searching", () => {
    const sections = buildWorktreeListSections(projects, sectionOptions({ query: "search" }));

    expect(sections.map((section) => section.prefix)).toEqual(["beta"]);
    expect(sections[0]?.rows.map((row) => row.worktree.branch)).toEqual(["feat/search"]);
  });

  it("applies show archived to every project", () => {
    const sections = buildWorktreeListSections(projects, sectionOptions({ showArchived: true, query: "old" }));

    expect(sections.map((section) => section.prefix)).toEqual(["gamma"]);
  });

  it("marks collapsed projects but still counts their rows", () => {
    const sections = buildWorktreeListSections(projects, sectionOptions({ collapsed: new Set(["beta"]) }));

    expect(sections[0]).toMatchObject({ prefix: "beta", collapsed: true });
    expect(sections[0]?.rows).toHaveLength(2);
    expect(sections[1]?.collapsed).toBe(false);
  });

  it("keeps a failed project with its last rows and no empty message", () => {
    const sections = buildWorktreeListSections(
      [createProject("broken", [], "git exploded"), createProject("stale", [createWorktree("a", { project: "stale" })], "timeout")],
      sectionOptions(),
    );

    expect(sections.map((section) => [section.error, section.emptyMessage, section.rows.length])).toEqual([
      ["git exploded", null, 0],
      ["timeout", null, 1],
    ]);
  });
});

describe("displayedWorktrees", () => {
  it("lists the rows of expanded projects top to bottom", () => {
    const sections = buildWorktreeListSections(
      [
        createProject("beta", [createWorktree("b1", { project: "beta" }), createWorktree("b2", { project: "beta" })]),
        createProject("alpha", [createWorktree("a1", { project: "alpha" })]),
        createProject("gamma", [createWorktree("g1", { project: "gamma" })]),
      ],
      sectionOptions({ collapsed: new Set(["alpha"]) }),
    );

    expect(displayedWorktrees(sections).map((w) => `${w.project}:${w.branch}`)).toEqual([
      "beta:b1",
      "beta:b2",
      "gamma:g1",
    ]);
  });
});
