import { describe, expect, it } from "vitest";
import {
  notificationKey,
  parseWorktreeKey,
  sameWorktree,
  worktreeKey,
} from "./worktree-ref";

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

  it("keys notifications by project and id", () => {
    expect(notificationKey({ project: "alpha", id: 1 })).not.toBe(notificationKey({ project: "beta", id: 1 }));
  });
});
