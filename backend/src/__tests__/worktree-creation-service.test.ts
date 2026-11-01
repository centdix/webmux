import { describe, expect, it } from "bun:test";
import { WorktreeCreationTracker, type WorktreeCreationProgress } from "../services/worktree-creation-service";

function progress(worktreeId: string, branch: string, fields: Partial<WorktreeCreationProgress> = {}): WorktreeCreationProgress {
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
});
