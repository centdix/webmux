import { describe, expect, it } from "bun:test";
import { apiContract } from "./contract";
import {
  ComponentCatalogStateSchema,
  CreateWorktreeRequestSchema,
  ProjectWorktreeSnapshotSchema,
} from "./schemas";

describe("component API contracts", () => {
  it("declares lifecycle validation failures on create", () => {
    expect(apiContract.createWorktree.responses).toHaveProperty("422");
  });

  it("accepts selected component ids on create", () => {
    expect(CreateWorktreeRequestSchema.parse({
      branch: "feature/catalog",
      components: ["service-alerts", "gateway-web"],
    }).components).toEqual(["service-alerts", "gateway-web"]);
  });

  it("validates the component catalog", () => {
    expect(ComponentCatalogStateSchema.parse({
      status: "ready",
      components: [{ id: "service-alerts", label: "Alerts", kind: "service" }],
      error: null,
    }).components).toHaveLength(1);
  });

  it("keeps runtime health in the shared services collection", () => {
    const snapshot = ProjectWorktreeSnapshotSchema.parse({
      branch: "feature/catalog",
      label: null,
      path: "/repo/worktree",
      dir: "/repo/worktree",
      archived: false,
      profile: "host",
      agentName: "claude",
      agentLabel: "Claude",
      agentTerminalStale: false,
      mux: true,
      dirty: false,
      unpushed: false,
      paneCount: 1,
      status: "running",
      elapsed: "1m",
      services: [],
      prs: [],
      linearIssue: null,
      creation: null,
      source: "ui",
      oneshot: null,
    });

    expect(snapshot.services).toEqual([]);
    expect(snapshot).not.toHaveProperty("components");
  });
});
