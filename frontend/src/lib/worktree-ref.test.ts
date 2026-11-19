import { describe, expect, it } from "vitest";
import type { WorktreeInfo } from "./types";
import {
  findSavedWorktree,
  legacyBranchKey,
  migrateBranchKeys,
  notificationKey,
  parseWorktreeKey,
  sameWorktree,
  worktreeKey,
} from "./worktree-ref";

type Named = Pick<WorktreeInfo, "project" | "id" | "branch">;

function worktree(project: string, id: string, branch: string): Named {
  return { project, id, branch };
}

describe("worktreeKey", () => {
  it("round-trips project and worktree id", () => {
    for (const ref of [
      { project: "webmux", id: "0c8f7e2a-1b3d-4c5e-9f60-7a8b9c0d1e2f" },
      { project: "image-generator", id: "u-0123456789abcdef" },
    ]) {
      expect(parseWorktreeKey(worktreeKey(ref))).toEqual(ref);
    }
  });

  it("keeps equal ids in different projects apart", () => {
    const keys = new Set([
      worktreeKey({ project: "alpha", id: "wt-1" }),
      worktreeKey({ project: "beta", id: "wt-1" }),
      worktreeKey({ project: "alpha", id: "wt-2" }),
    ]);
    expect(keys.size).toBe(3);
  });

  it("rejects strings that are not keys", () => {
    expect(parseWorktreeKey("main")).toBeNull();
    expect(parseWorktreeKey(":main")).toBeNull();
    expect(parseWorktreeKey("alpha:")).toBeNull();
  });
});

describe("worktree ref helpers", () => {
  it("compares refs by project and id", () => {
    expect(sameWorktree({ project: "a", id: "x" }, { project: "a", id: "x" })).toBe(true);
    expect(sameWorktree({ project: "a", id: "x" }, { project: "b", id: "x" })).toBe(false);
    expect(sameWorktree(null, { project: "a", id: "x" })).toBe(false);
  });

  it("finds a saved worktree by id, else by a branch saved by older versions", () => {
    const worktrees = [worktree("alpha", "wt-1", "main"), worktree("alpha", "wt-2", "wt-1")];
    expect(findSavedWorktree(worktrees, "wt-1")?.id).toBe("wt-1");
    expect(findSavedWorktree(worktrees, "main")?.id).toBe("wt-1");
    expect(findSavedWorktree(worktrees, "gone")).toBeUndefined();
  });

  it("keys notifications by project and id", () => {
    expect(notificationKey({ project: "alpha", id: 1 })).not.toBe(notificationKey({ project: "beta", id: 1 }));
  });
});

describe("migrateBranchKeys", () => {
  const loaded: Record<string, Named[]> = {
    alpha: [worktree("alpha", "wt-1", "feat/x"), worktree("alpha", "wt-2", "main")],
  };
  const worktreesOf = (project: string): Named[] | null => loaded[project] ?? null;

  it("moves branch keys of loaded projects to ids", () => {
    const keys = new Set([legacyBranchKey("alpha", "feat/x"), worktreeKey({ project: "alpha", id: "wt-2" })]);
    expect(migrateBranchKeys(keys, worktreesOf)).toEqual(new Set(["alpha:wt-1", "alpha:wt-2"]));
  });

  it("keeps keys of projects not loaded yet, and keys naming no worktree", () => {
    const keys = new Set([legacyBranchKey("beta", "feat/x"), legacyBranchKey("alpha", "gone"), "alpha:wt-1"]);
    expect(migrateBranchKeys(keys, worktreesOf)).toBeNull();
  });
});
