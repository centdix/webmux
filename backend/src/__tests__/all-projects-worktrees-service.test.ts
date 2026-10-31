import { describe, expect, it } from "bun:test";
import {
  collectAllProjectWorktrees,
  hubReconcileOptions,
  IDLE_PROJECT_RECONCILE_FRESHNESS_MS,
} from "../services/all-projects-worktrees-service";

describe("all-projects-worktrees-service", () => {
  it("returns each project's worktrees in input order", async () => {
    const result = await collectAllProjectWorktrees([
      { prefix: "a", name: "Alpha", readWorktrees: async () => { await Bun.sleep(5); return ["a1", "a2"]; } },
      { prefix: "b", name: "Beta", readWorktrees: async () => ["b1"] },
    ]);
    expect(result).toEqual([
      { prefix: "a", name: "Alpha", worktrees: ["a1", "a2"], error: null },
      { prefix: "b", name: "Beta", worktrees: ["b1"], error: null },
    ]);
  });

  it("reports a failing project as an error entry while others succeed", async () => {
    const result = await collectAllProjectWorktrees([
      { prefix: "a", name: "Alpha", readWorktrees: async () => { throw new Error("git exploded"); } },
      { prefix: "b", name: "Beta", readWorktrees: async () => ["b1"] },
    ]);
    expect(result).toEqual([
      { prefix: "a", name: "Alpha", worktrees: [], error: "git exploded" },
      { prefix: "b", name: "Beta", worktrees: ["b1"], error: null },
    ]);
  });

  it("stringifies a non-Error rejection", async () => {
    const result = await collectAllProjectWorktrees<string>([
      { prefix: "a", name: "Alpha", readWorktrees: () => Promise.reject("plain failure") },
    ]);
    expect(result).toEqual([{ prefix: "a", name: "Alpha", worktrees: [], error: "plain failure" }]);
  });

  it("uses the default reconcile freshness for active projects only", () => {
    expect(hubReconcileOptions(true)).toEqual({});
    expect(hubReconcileOptions(false)).toEqual({ freshnessMs: IDLE_PROJECT_RECONCILE_FRESHNESS_MS });
  });

  it("returns an empty list when there are no projects", async () => {
    expect(await collectAllProjectWorktrees<string>([])).toEqual([]);
  });
});
