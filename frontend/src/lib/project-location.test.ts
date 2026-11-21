import { afterEach, describe, expect, it } from "vitest";
import {
  formatLocationHash,
  parseLocationHash,
  pickInitialSelection,
  pickInitialProject,
  readLocationHash,
  resolveHashTarget,
  writeLocationHash,
} from "./project-location";

describe("location hash", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("round-trips branches containing slashes", () => {
    const hash = formatLocationHash("webmux", "feat/nested/x");

    expect(hash).toBe("#webmux/feat/nested/x");
    expect(parseLocationHash(hash)).toEqual({ project: "webmux", branch: "feat/nested/x" });
  });

  it("encodes characters that are unsafe in a hash", () => {
    const hash = formatLocationHash("webmux", "fix/50%#done ok");

    expect(hash).toBe("#webmux/fix/50%25%23done%20ok");
    expect(parseLocationHash(hash)).toEqual({ project: "webmux", branch: "fix/50%#done ok" });
  });

  it("formats and parses a project without a branch", () => {
    expect(formatLocationHash("webmux", null)).toBe("#webmux");
    expect(parseLocationHash("#webmux")).toEqual({ project: "webmux", branch: null });
    expect(parseLocationHash("#webmux/")).toEqual({ project: "webmux", branch: null });
  });

  it("rejects empty or malformed hashes", () => {
    expect(parseLocationHash("")).toBeNull();
    expect(parseLocationHash("#")).toBeNull();
    expect(parseLocationHash("#/feat")).toBeNull();
    expect(parseLocationHash("#webmux/%E0%A4%A")).toBeNull();
  });

  it("writes the hash without changing the path, and clears it", () => {
    writeLocationHash("webmux", "feat/x");

    expect(window.location.pathname).toBe("/");
    expect(window.location.hash).toBe("#webmux/feat/x");
    expect(readLocationHash()).toEqual({ project: "webmux", branch: "feat/x" });

    writeLocationHash(null, null);

    expect(window.location.hash).toBe("");
    expect(readLocationHash()).toBeNull();
  });
});

describe("pickInitialProject", () => {
  const projects = ["alpha", "beta", "gamma"];

  it("prefers a valid hash project", () => {
    expect(pickInitialProject(projects, "gamma", "beta")).toBe("gamma");
  });

  it("falls back to the saved project when the hash is missing or unknown", () => {
    expect(pickInitialProject(projects, null, "beta")).toBe("beta");
    expect(pickInitialProject(projects, "removed", "beta")).toBe("beta");
  });

  it("falls back to the first project when nothing valid is saved", () => {
    expect(pickInitialProject(projects, null, null)).toBe("alpha");
    expect(pickInitialProject(projects, "removed", "also-removed")).toBe("alpha");
  });

  it("returns null when no project is registered", () => {
    expect(pickInitialProject([], "alpha", "beta")).toBeNull();
  });
});

describe("pickInitialSelection", () => {
  it("prefers the hash branch when the hash targets this project", () => {
    expect(pickInitialSelection({ project: "alpha", branch: "feat/x" }, "alpha", "wt-main")).toEqual({
      project: "alpha",
      name: "feat/x",
      source: "hash",
    });
  });

  it("uses the saved worktree when the hash targets another project or has no branch", () => {
    const saved = { project: "alpha", name: "wt-main", source: "saved" };
    expect(pickInitialSelection({ project: "beta", branch: "feat/x" }, "alpha", "wt-main")).toEqual(saved);
    expect(pickInitialSelection({ project: "alpha", branch: null }, "alpha", "wt-main")).toEqual(saved);
    expect(pickInitialSelection(null, "alpha", null)).toBeNull();
  });
});

describe("resolveHashTarget", () => {
  const worktrees = [
    { project: "alpha", id: "wt-1", branch: "main" },
    { project: "beta", id: "wt-2", branch: "feat/x" },
  ];
  const hasProject = (project: string): boolean => project === "alpha" || project === "beta";
  const findWorktree = (project: string, branch: string) =>
    worktrees.find((worktree) => worktree.project === project && worktree.branch === branch);
  const resolve = (hash: string) => resolveHashTarget(parseLocationHash(hash), hasProject, findWorktree);

  it("targets a known worktree or project", () => {
    expect(resolve("#beta/feat/x")).toEqual({ kind: "worktree", ref: { project: "beta", id: "wt-2" } });
    expect(resolve("#beta")).toEqual({ kind: "project", project: "beta" });
  });

  it("targets nothing for an unknown project or branch, or no hash", () => {
    expect(resolve("#gamma/main")).toBeNull();
    expect(resolve("#gamma")).toBeNull();
    expect(resolve("#alpha/missing")).toBeNull();
    expect(resolve("")).toBeNull();
  });
});
