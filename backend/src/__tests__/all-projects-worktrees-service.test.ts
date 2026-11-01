import { describe, expect, it } from "bun:test";
import { AllProjectWorktreesQuerySchema } from "@webmux/api-contract";
import { parseQuery } from "../api-validation";
import {
  collectAllProjectWorktrees,
  hubReconcileOptions,
  IDLE_PROJECT_RECONCILE_FRESHNESS_MS,
  listAllProjectWorktrees,
} from "../services/all-projects-worktrees-service";
import { DashboardActivityTracker } from "../services/dashboard-activity";

function listing(worktrees: string[], pendingCreations: string[] = []): { worktrees: string[]; pendingCreations: string[] } {
  return { worktrees, pendingCreations };
}

describe("all-projects-worktrees-service", () => {
  it("returns each project's worktrees and pending creations in input order", async () => {
    const result = await collectAllProjectWorktrees([
      { prefix: "a", name: "Alpha", readWorktrees: async () => { await Bun.sleep(5); return listing(["a1", "a2"], ["a-naming"]); }, isServed: () => true },
      { prefix: "b", name: "Beta", readWorktrees: async () => listing(["b1"]), isServed: () => true },
    ]);
    expect(result).toEqual([
      { prefix: "a", name: "Alpha", worktrees: ["a1", "a2"], pendingCreations: ["a-naming"], error: null },
      { prefix: "b", name: "Beta", worktrees: ["b1"], pendingCreations: [], error: null },
    ]);
  });

  it("reports a failing project as an error entry while others succeed", async () => {
    const result = await collectAllProjectWorktrees([
      { prefix: "a", name: "Alpha", readWorktrees: async () => { throw new Error("git exploded"); }, isServed: () => true },
      { prefix: "b", name: "Beta", readWorktrees: async () => listing(["b1"]), isServed: () => true },
    ]);
    expect(result).toEqual([
      { prefix: "a", name: "Alpha", worktrees: [], pendingCreations: [], error: "git exploded" },
      { prefix: "b", name: "Beta", worktrees: ["b1"], pendingCreations: [], error: null },
    ]);
  });

  it("stringifies a non-Error rejection", async () => {
    const result = await collectAllProjectWorktrees<string, string>([
      { prefix: "a", name: "Alpha", readWorktrees: () => Promise.reject("plain failure"), isServed: () => true },
    ]);
    expect(result).toEqual([{ prefix: "a", name: "Alpha", worktrees: [], pendingCreations: [], error: "plain failure" }]);
  });

  it("uses the default reconcile freshness for active projects only", () => {
    expect(hubReconcileOptions(true)).toEqual({});
    expect(hubReconcileOptions(false)).toEqual({ freshnessMs: IDLE_PROJECT_RECONCILE_FRESHNESS_MS });
  });

  it("drops a project removed while its worktrees were being read", async () => {
    let served = true;
    const result = await collectAllProjectWorktrees([
      { prefix: "a", name: "Alpha", readWorktrees: async () => listing(["a1"]), isServed: () => true },
      {
        prefix: "gone",
        name: "Gone",
        readWorktrees: async () => {
          await Bun.sleep(5);
          served = false;
          return listing(["g1"]);
        },
        isServed: () => served,
      },
    ]);
    expect(result.map((p) => p.prefix)).toEqual(["a"]);
  });

  it("returns an empty list when there are no projects", async () => {
    expect(await collectAllProjectWorktrees<string, string>([])).toEqual([]);
  });
});

describe("listAllProjectWorktrees", () => {
  const sources = [
    { prefix: "a", name: "Alpha", readWorktrees: async () => listing(["a1"]), isServed: () => true },
    { prefix: "b", name: "Beta", readWorktrees: async () => listing(["b1"]), isServed: () => true },
  ];

  it("records a poll without focus as visible activity for every project", async () => {
    const tracker = new DashboardActivityTracker();
    const result = await listAllProjectWorktrees(undefined, sources, tracker);
    expect(result.map((p) => p.prefix)).toEqual(["a", "b"]);
    expect(tracker.activityOf("a")).toBe("visible");
    expect(tracker.activityOf("b")).toBe("visible");
  });

  it("marks the focused project focused", async () => {
    const tracker = new DashboardActivityTracker();
    await listAllProjectWorktrees("a", sources, tracker);
    expect(tracker.activityOf("a")).toBe("focused");
    expect(tracker.activityOf("b")).toBe("visible");
  });

  it("accepts an empty focus query instead of rejecting the listing", () => {
    const parsed = parseQuery(new Request("http://localhost/api/projects/worktrees?focus="), AllProjectWorktreesQuerySchema);
    expect(parsed.ok && parsed.data).toEqual({ focus: "" });
  });

  it.each(["", "unknown"])("lists everything and focuses nothing for focus %p", async (focus) => {
    const tracker = new DashboardActivityTracker();
    const result = await listAllProjectWorktrees(focus, sources, tracker);
    expect(result).toHaveLength(2);
    expect(tracker.activityOf(focus)).toBe("visible");
    expect(tracker.activityOf("a")).toBe("visible");
  });
});
