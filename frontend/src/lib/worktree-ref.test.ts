import { describe, expect, it } from "vitest";
import { notificationKey, parseWorktreeKey, sameWorktree, worktreeKey } from "./worktree-ref";

describe("worktreeKey", () => {
  it("round-trips branches that contain slashes", () => {
    for (const ref of [
      { project: "webmux", branch: "main" },
      { project: "image-generator", branch: "feature/a/b" },
      { project: "a-2", branch: "fix/x-1.2" },
    ]) {
      expect(parseWorktreeKey(worktreeKey(ref))).toEqual(ref);
    }
  });

  it("keeps equal branch names in different projects apart", () => {
    const keys = new Set([
      worktreeKey({ project: "alpha", branch: "main" }),
      worktreeKey({ project: "beta", branch: "main" }),
      worktreeKey({ project: "alpha", branch: "beta/main" }),
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
  it("compares refs by project and branch", () => {
    expect(sameWorktree({ project: "a", branch: "x" }, { project: "a", branch: "x" })).toBe(true);
    expect(sameWorktree({ project: "a", branch: "x" }, { project: "b", branch: "x" })).toBe(false);
    expect(sameWorktree(null, { project: "a", branch: "x" })).toBe(false);
  });

  it("keys notifications by project and id", () => {
    expect(notificationKey({ project: "alpha", id: 1 })).not.toBe(notificationKey({ project: "beta", id: 1 }));
  });
});
