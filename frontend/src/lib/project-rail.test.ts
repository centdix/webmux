import { describe, expect, it } from "vitest";
import type { ProjectWorktreeList, WorktreeInfo } from "./types";
import { buildProjectRail, projectInitials, projectRailTitle, projectTint } from "./project-rail";

function createWorktree(branch: string, overrides: Partial<WorktreeInfo> = {}): WorktreeInfo {
  return {
    project: "webmux",
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

  it("cycles the tints by order", () => {
    expect(projectTint(0)).toBe(projectTint(4));
    expect(projectTint(0)).not.toBe(projectTint(1));
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
