import { afterEach, describe, expect, it, vi } from "vitest";

const { pullMain } = vi.hoisted(() => ({ pullMain: vi.fn() }));

vi.mock("./api", () => ({
  projectApi: vi.fn(() => ({ pullMain })),
  fetchProjects: vi.fn(),
  removeProject: vi.fn(),
}));

import { fetchProjects, projectApi, removeProject } from "./api";
import { ProjectPull, ProjectRemoval } from "./project-actions.svelte";

describe("ProjectPull", () => {
  afterEach(() => vi.clearAllMocks());

  it("offers a force pull once a fast-forward fails, then pulls with force", async () => {
    const toast = vi.fn();
    const pull = new ProjectPull(toast);
    pull.start({ project: "images", repo: { repo: "shared", label: "shared", ideUrl: null } });
    pullMain.mockResolvedValueOnce({ status: "merge_failed", error: "diverged" });

    await pull.confirm();

    expect(projectApi).toHaveBeenCalledWith("images");
    expect(pullMain).toHaveBeenLastCalledWith({ body: { repo: "shared" } });
    expect(pull.force).toBe(true);
    expect(pull.error).toContain("diverged");
    expect(pull.target).not.toBeNull();

    pullMain.mockResolvedValueOnce({ status: "updated" });
    await pull.confirm();

    expect(pullMain).toHaveBeenLastCalledWith({ body: { force: true, repo: "shared" } });
    expect(pull.target).toBeNull();
    expect(toast).toHaveBeenCalledWith({ tone: "success", message: 'Pulled latest "shared" from remote' });
  });
});

describe("ProjectRemoval", () => {
  afterEach(() => vi.clearAllMocks());

  it("hands the remaining projects over once removed", async () => {
    const onRemoved = vi.fn();
    const removal = new ProjectRemoval(onRemoved);
    const remaining = [{ prefix: "webmux", name: "webmux", path: "/repo", active: true }];
    vi.mocked(removeProject).mockResolvedValue(undefined);
    vi.mocked(fetchProjects).mockResolvedValue(remaining);
    removal.start({ prefix: "images", name: "images" });

    await removal.confirm();

    expect(removeProject).toHaveBeenCalledWith("images");
    expect(onRemoved).toHaveBeenCalledWith("images", remaining);
    expect(removal.target).toBeNull();
  });

  it("keeps the target with the error when reloading the projects fails", async () => {
    const onRemoved = vi.fn();
    const removal = new ProjectRemoval(onRemoved);
    vi.mocked(removeProject).mockResolvedValue(undefined);
    vi.mocked(fetchProjects).mockRejectedValue(new Error("offline"));
    removal.start({ prefix: "images", name: "images" });

    await removal.confirm();

    expect(onRemoved).not.toHaveBeenCalled();
    expect(removal.target).toEqual({ prefix: "images", name: "images" });
    expect(removal.error).toBe("offline");
  });
});
