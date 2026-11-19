import { describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  createWorktreeTab: vi.fn(async () => ({})),
  selectWorktreeTab: vi.fn(async () => ({})),
  deleteWorktreeTab: vi.fn(async () => ({})),
}));

import { createWorktreeTab, deleteWorktreeTab, selectWorktreeTab } from "./api";
import { WorktreeActions, type WorktreeActionsDeps } from "./worktree-actions.svelte";

describe("WorktreeActions tabs", () => {
  it("addresses tab create/select/delete by worktree id", async () => {
    const store = { refresh: vi.fn(async () => {}) } as unknown as WorktreeActionsDeps["store"];
    const actions = new WorktreeActions({ store, toast: vi.fn(), leave: vi.fn(), onBranchesChanged: vi.fn() });
    const ref = { project: "myproject", id: "wt-tabs" };

    await actions.createTab(ref);
    await actions.selectTab(ref, "fork-1");
    await actions.deleteTab(ref, "fork-1");

    expect(createWorktreeTab).toHaveBeenCalledWith("myproject", "wt-tabs");
    expect(selectWorktreeTab).toHaveBeenCalledWith("myproject", "wt-tabs", "fork-1");
    expect(deleteWorktreeTab).toHaveBeenCalledWith("myproject", "wt-tabs", "fork-1");
  });
});
