import { describe, expect, it } from "bun:test";
import { AllProjectWorktreesResponseSchema, ProjectSnapshotSchema, ProjectWorktreeSnapshotSchema } from "./schemas";

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

const pendingCreation = {
  id: "0b8c5d2e-4f1a-4c3e-9a7b-1d2e3f4a5b6c",
  profile: "default",
  agentName: "claude",
  agentLabel: "Claude Code",
  phase: "naming_branch",
  source: "ui",
};

describe("pending creations", () => {
  it("lists creations still naming their branch on the project snapshot", () => {
    const snapshot = ProjectSnapshotSchema.parse({
      project: { name: "webmux", mainBranch: "main" },
      worktrees: [worktree],
      pendingCreations: [pendingCreation],
      notifications: [],
    });
    expect(snapshot.pendingCreations).toEqual([pendingCreation]);
  });

  it("lists them per project in the hub listing", () => {
    const response = AllProjectWorktreesResponseSchema.parse({
      projects: [{ prefix: "webmux", name: "webmux", worktrees: [], pendingCreations: [pendingCreation], error: null }],
    });
    expect(response.projects[0]?.pendingCreations).toEqual([pendingCreation]);
  });

  it("defaults to none for servers that do not send them", () => {
    const response = AllProjectWorktreesResponseSchema.parse({
      projects: [{ prefix: "webmux", name: "webmux", worktrees: [worktree], error: null }],
    });
    expect(response.projects[0]?.pendingCreations).toEqual([]);
  });

  it("rejects a pending creation without its id", () => {
    const { id: _id, ...withoutId } = pendingCreation;
    expect(
      ProjectSnapshotSchema.safeParse({
        project: { name: "webmux", mainBranch: "main" },
        worktrees: [],
        pendingCreations: [withoutId],
        notifications: [],
      }).success,
    ).toBe(false);
  });
});
