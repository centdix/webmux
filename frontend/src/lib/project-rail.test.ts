import { describe, expect, it } from "vitest";
import type { ProjectWorktreeList, WorktreeInfo } from "./types";
import { buildProjectRail, projectInitials, projectRailInitials, projectRailTitle, projectTint } from "./project-rail";

function createWorktree(branch: string, overrides: Partial<WorktreeInfo> = {}): WorktreeInfo {
  return {
    project: "webmux",
    id: `wt-${branch}`,
    branch,
    label: null,
    archived: false,
    agent: "idle",
    mux: "✓",
    path: `/repo/${branch}`,
    dir: `/repo/${branch}`,
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

function createProject(prefix: string, worktrees: WorktreeInfo[], error: string | null = null): ProjectWorktreeList {
  return { prefix, name: prefix, worktrees, error };
}

describe("projectInitials", () => {
  it("takes the first letters of the first two words, else the first two letters", () => {
    expect(projectInitials("image-generator")).toBe("IG");
    expect(projectInitials("my_cool app")).toBe("MC");
    expect(projectInitials("webmux")).toBe("WE");
    expect(projectInitials("x")).toBe("X");
  });

});

describe("projectRailInitials", () => {
  it("keeps the plain initials when they are unique", () => {
    expect(projectRailInitials(["image-generator", "webmux"])).toEqual(["IG", "WE"]);
  });

  it("numbers the later projects whose initials collide, in registered order", () => {
    expect(projectRailInitials(["web-app", "webmux", "web-api", "wild-ape"])).toEqual(["WA", "WE", "WA2", "WA3"]);
  });

  it("does not change when an unrelated project is added", () => {
    expect(projectRailInitials(["web-app", "image-generator", "web-api"])).toEqual(["WA", "IG", "WA2"]);
  });

  it("skips a suffixed value another project already has as its initials", () => {
    expect(projectRailInitials(["x", "x2", "x"])).toEqual(["X", "X2", "X3"]);
  });
});

describe("projectTint", () => {
  it("gives the first eight projects distinct tints, then cycles", () => {
    const tints = Array.from({ length: 8 }, (_, index) => projectTint(index));
    expect(new Set(tints).size).toBe(8);
    expect(projectTint(8)).toBe(projectTint(0));
  });
});

describe("buildProjectRail", () => {
  it("keeps the given order and counts what needs you among active worktrees", () => {
    const rail = buildProjectRail(
      [
        createProject("webmux", [
          createWorktree("waiting", { agent: "waiting" }),
          createWorktree("error", { agent: "error" }),
          createWorktree("unread", { agent: "done" }),
          createWorktree("read", { agent: "done" }),
          createWorktree("closed", { agent: "waiting", mux: "" }),
          createWorktree("archived", { agent: "waiting", archived: true }),
        ]),
        createProject("images", [createWorktree("busy", { project: "images", agent: "working" })]),
        createProject("broken", [], "git exploded"),
      ],
      new Set(["webmux:unread"]),
    );

    expect(rail.map((item) => [item.prefix, item.needsYou, item.running, item.error])).toEqual([
      ["webmux", 3, false, null],
      ["images", 0, true, null],
      ["broken", 0, false, "git exploded"],
    ]);
    expect(rail[0]?.initials).toBe("WE");
  });

  it("disambiguates colliding initials across the rail", () => {
    const rail = buildProjectRail([createProject("web-app", []), createProject("web-api", [])], new Set());

    expect(rail.map((item) => item.initials)).toEqual(["WA", "WA2"]);
  });

  it("counts a worktree being created as running", () => {
    const [item] = buildProjectRail([createProject("webmux", [createWorktree("new", { creating: true })])], new Set());

    expect(item?.running).toBe(true);
  });

  it("titles an avatar with the name and its badges", () => {
    const [item] = buildProjectRail(
      [createProject("webmux", [createWorktree("a", { agent: "waiting" }), createWorktree("b", { agent: "working" })], "boom")],
      new Set(),
    );

    expect(item && projectRailTitle(item)).toBe("webmux · 1 needs you · agents running · failed to load");
  });
});
