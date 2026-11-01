import { afterEach, describe, expect, it } from "vitest";
import { neighborBranch, stepBranch, WorktreeSelection } from "./worktree-selection.svelte";

afterEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("stepBranch", () => {
  const branches = ["a", "b", "c"];

  it("starts from either end when nothing is selected", () => {
    expect(stepBranch(branches, null, 1)).toBe("a");
    expect(stepBranch(branches, null, -1)).toBe("c");
  });

  it("moves within the list and stays put at its ends", () => {
    expect(stepBranch(branches, "b", 1)).toBe("c");
    expect(stepBranch(branches, "b", -1)).toBe("a");
    expect(stepBranch(branches, "c", 1)).toBe("c");
    expect(stepBranch([], "x", 1)).toBe("x");
  });
});

describe("neighborBranch", () => {
  it("prefers the row above, skipping rows being removed", () => {
    expect(neighborBranch(["a", "b", "c"], "b", new Set())).toBe("a");
    expect(neighborBranch(["a", "b", "c"], "b", new Set(["a"]))).toBe("c");
    expect(neighborBranch(["a", "b", "c"], "a", new Set())).toBe("b");
    expect(neighborBranch(["a"], "a", new Set())).toBeNull();
  });
});

describe("WorktreeSelection", () => {
  it("boots on the hash worktree, else the one saved for the project", () => {
    localStorage.setItem("wt-last-selected-worktree:alpha", "saved");
    expect(new WorktreeSelection("alpha").selected).toEqual({ project: "alpha", branch: "saved" });

    window.history.replaceState(null, "", "/#alpha/feat/x");
    expect(new WorktreeSelection("alpha").selected).toEqual({ project: "alpha", branch: "feat/x" });
    expect(new WorktreeSelection("beta").selected).toBeNull();
  });

  it("makes a selected worktree's project current", () => {
    const selection = new WorktreeSelection("alpha");

    selection.select({ project: "beta", branch: "main" });

    expect(selection.project).toBe("beta");
    expect(selection.branch).toBe("main");
  });

  it("switching project restores that project's saved worktree", () => {
    localStorage.setItem("wt-last-selected-worktree:beta", "feat/b");
    const selection = new WorktreeSelection("alpha");
    selection.selectBranch("main");

    selection.switchProject("beta");
    expect(selection.selected).toEqual({ project: "beta", branch: "feat/b" });

    selection.switchProject("alpha");
    expect(selection.selected).toBeNull();
  });

  it("persists into the hash and clears the saved worktree once the project is empty", () => {
    localStorage.setItem("wt-last-selected-worktree:alpha", "gone");
    const selection = new WorktreeSelection("alpha");

    selection.persist(undefined, false, false);
    expect(window.location.hash).toBe("#alpha/gone");
    expect(localStorage.getItem("wt-last-selected-worktree:alpha")).toBe("gone");

    selection.selectBranch(null);
    selection.persist(undefined, true, false);
    expect(window.location.hash).toBe("#alpha");
    expect(localStorage.getItem("wt-last-selected-worktree:alpha")).toBeNull();
  });
});
