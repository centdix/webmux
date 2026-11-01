import { describe, expect, it } from "bun:test";
import { ProjectWorktreeSnapshotSchema } from "./schemas";

const worktree = {
  id: "unmanaged:/repo/__worktrees/feature-search",
  branch: "feature/search",
  label: null,
  path: "/repo/__worktrees/feature-search",
  dir: "/repo/__worktrees/feature-search",
  archived: false,
  profile: null,
  agentName: null,
  agentLabel: null,
  agentTerminalStale: false,
  mux: false,
  dirty: false,
  unpushed: false,
  paneCount: 0,
  status: "closed",
  elapsed: "",
  services: [],
  prs: [],
  linearIssue: null,
  creation: null,
  source: "ui",
  oneshot: null,
};

describe("ProjectWorktreeSnapshotSchema", () => {
  it("carries the runtime worktree id", () => {
    expect(ProjectWorktreeSnapshotSchema.parse(worktree).id).toBe("unmanaged:/repo/__worktrees/feature-search");
  });

  it("requires the id", () => {
    const { id: _id, ...withoutId } = worktree;
    expect(ProjectWorktreeSnapshotSchema.safeParse(withoutId).success).toBe(false);
  });
});
