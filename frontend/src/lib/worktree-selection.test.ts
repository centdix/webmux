import { afterEach, describe, expect, it } from "vitest";
import type { WorktreeInfo } from "./types";
import { neighborKey, stepKey, WorktreeSelection } from "./worktree-selection.svelte";

afterEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("stepKey", () => {
  const branches = ["a", "b", "c"];

  it("starts from either end when nothing is selected", () => {
    expect(stepKey(branches, null, 1)).toBe("a");
    expect(stepKey(branches, null, -1)).toBe("c");
  });

  it("moves within the list and stays put at its ends", () => {
    expect(stepKey(branches, "b", 1)).toBe("c");
    expect(stepKey(branches, "b", -1)).toBe("a");
    expect(stepKey(branches, "c", 1)).toBe("c");
    expect(stepKey([], "x", 1)).toBe("x");
  });
});

describe("neighborKey", () => {
  it("prefers the row above, skipping rows being removed", () => {
    expect(neighborKey(["a", "b", "c"], "b", new Set())).toBe("a");
    expect(neighborKey(["a", "b", "c"], "b", new Set(["a"]))).toBe("c");
    expect(neighborKey(["a", "b", "c"], "a", new Set())).toBe("b");
    expect(neighborKey(["a"], "a", new Set())).toBeNull();
  });
});

function worktree(id: string, branch: string): Pick<WorktreeInfo, "project" | "id" | "branch"> {
  return { project: "alpha", id, branch };
}

describe("WorktreeSelection", () => {
  it("boots on the hash worktree, else the one saved for the project, once the list has loaded", () => {
    const worktrees = [worktree("wt-1", "feat/x"), worktree("wt-2", "main")];
    localStorage.setItem("wt-last-selected-worktree:alpha", "wt-2");
    const saved = new WorktreeSelection("alpha");
    expect(saved.selected).toBeNull();
    saved.resolvePending(worktrees);
    expect(saved.selected).toEqual({ project: "alpha", id: "wt-2" });

    window.history.replaceState(null, "", "/#alpha/feat/x");
    const hashed = new WorktreeSelection("alpha");
    hashed.resolvePending(worktrees);
    expect(hashed.selected).toEqual({ project: "alpha", id: "wt-1" });
    expect(new WorktreeSelection("beta").pending).toBeNull();
  });

  it("makes a selected worktree's project current", () => {
    const selection = new WorktreeSelection("alpha");

    selection.select({ project: "beta", id: "wt-main" });

    expect(selection.project).toBe("beta");
    expect(selection.id).toBe("wt-main");
  });

  it("switching project restores that project's saved worktree", () => {
    localStorage.setItem("wt-last-selected-worktree:beta", "wt-b");
    const selection = new WorktreeSelection("alpha");
    selection.selectId("wt-main");

    selection.switchProject("beta");
    expect(selection.selected).toBeNull();
    expect(selection.pending).toEqual({ project: "beta", id: "wt-b" });

    selection.switchProject("alpha");
    expect(selection.pending).toBeNull();
  });

  it("stays on the worktree when its branch is renamed, and moves the hash to the new branch", () => {
    const selection = new WorktreeSelection("alpha");
    selection.selectId("wt-1");

    selection.persist(worktree("wt-1", "change-me"), true, true);
    expect(window.location.hash).toBe("#alpha/change-me");

    selection.persist(worktree("wt-1", "feat/named"), true, true);
    expect(selection.selected).toEqual({ project: "alpha", id: "wt-1" });
    expect(window.location.hash).toBe("#alpha/feat/named");
    expect(localStorage.getItem("wt-last-selected-worktree:alpha")).toBe("wt-1");
  });

  it("keeps the hash branch until the list loads, and clears the saved worktree once the project is empty", () => {
    localStorage.setItem("wt-last-selected-worktree:alpha", "wt-gone");
    window.history.replaceState(null, "", "/#alpha/feat/x");
    const selection = new WorktreeSelection("alpha");

    selection.persist(undefined, false, false);
    expect(window.location.hash).toBe("#alpha/feat/x");
    expect(localStorage.getItem("wt-last-selected-worktree:alpha")).toBe("wt-gone");

    selection.resolvePending([]);
    selection.persist(undefined, true, false);
    expect(window.location.hash).toBe("#alpha");
    expect(localStorage.getItem("wt-last-selected-worktree:alpha")).toBeNull();
  });
});
