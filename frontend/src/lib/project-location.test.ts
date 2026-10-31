import { afterEach, describe, expect, it } from "vitest";
import {
  formatLocationHash,
  parseLocationHash,
  pickInitialBranch,
  pickInitialProject,
  readLocationHash,
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

describe("pickInitialBranch", () => {
  it("prefers the hash branch when the hash targets this project", () => {
    expect(pickInitialBranch({ project: "alpha", branch: "feat/x" }, "alpha", "main")).toBe("feat/x");
  });

  it("uses the saved branch when the hash targets another project or has no branch", () => {
    expect(pickInitialBranch({ project: "beta", branch: "feat/x" }, "alpha", "main")).toBe("main");
    expect(pickInitialBranch({ project: "alpha", branch: null }, "alpha", "main")).toBe("main");
    expect(pickInitialBranch(null, "alpha", null)).toBeNull();
  });
});
