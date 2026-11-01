import { describe, expect, it } from "bun:test";
import {
  WorktreeCreationTracker,
  type NamingBranchProgress,
  type ResolvedWorktreeCreationProgress,
} from "../services/worktree-creation-service";

function progress(
  worktreeId: string,
  branch: string,
  fields: Partial<ResolvedWorktreeCreationProgress> = {},
): ResolvedWorktreeCreationProgress {
  return {
    worktreeId,
    branch,
    path: `/repo/__worktrees/${branch}`,
    profile: "default",
    agent: "claude",
    phase: "creating_worktree",
    source: "ui",
    ...fields,
  };
}

function naming(worktreeId: string, agent = "claude"): NamingBranchProgress {
  return { worktreeId, profile: "default", agent, phase: "naming_branch", source: "ui" };
}

describe("WorktreeCreationTracker", () => {
  it("tracks each creation by worktree id and updates it in place", () => {
    const tracker = new WorktreeCreationTracker();
    tracker.set(progress("wt_a", "feature/a"));
    tracker.set(progress("wt_b", "feature/b"));
    tracker.set(progress("wt_a", "feature/a", { phase: "starting_session" }));

    expect(tracker.list().map((state) => [state.worktreeId, state.branch, state.phase])).toEqual([
      ["wt_a", "feature/a", "starting_session"],
      ["wt_b", "feature/b", "creating_worktree"],
    ]);
  });

  it("answers whether a branch is being created and forgets it once cleared by id", () => {
    const tracker = new WorktreeCreationTracker();
    tracker.set(progress("wt_a", "feature/a"));

    expect(tracker.hasBranch("feature/a")).toBe(true);
    expect(tracker.hasBranch("feature/b")).toBe(false);
    expect(tracker.clear("feature/a")).toBe(false);
    expect(tracker.clear("wt_a")).toBe(true);
    expect(tracker.hasBranch("feature/a")).toBe(false);
    expect(tracker.list()).toEqual([]);
  });

  it("lists creations still naming their branch apart, in request order", () => {
    const tracker = new WorktreeCreationTracker();
    tracker.set(naming("wt_z", "codex"));
    tracker.set(naming("wt_a"));
    tracker.set(progress("wt_b", "feature/b"));

    expect(tracker.listPending()).toEqual([
      { worktreeId: "wt_z", profile: "default", agentName: "codex", phase: "naming_branch", source: "ui" },
      { worktreeId: "wt_a", profile: "default", agentName: "claude", phase: "naming_branch", source: "ui" },
    ]);
    expect(tracker.list().map((state) => state.worktreeId)).toEqual(["wt_b"]);
  });

  it("moves an id from naming to creating once its branch is known, never listing it twice", () => {
    const tracker = new WorktreeCreationTracker();
    tracker.set(naming("wt_a"));
    tracker.set(progress("wt_a", "fix-login"));

    expect(tracker.listPending()).toEqual([]);
    expect(tracker.list().map((state) => [state.worktreeId, state.branch])).toEqual([["wt_a", "fix-login"]]);
    expect(tracker.hasBranch("fix-login")).toBe(true);
  });

  it("forgets a naming creation once cleared", () => {
    const tracker = new WorktreeCreationTracker();
    tracker.set(naming("wt_a"));

    expect(tracker.clear("wt_a")).toBe(true);
    expect(tracker.listPending()).toEqual([]);
  });
});
