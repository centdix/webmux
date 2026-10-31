import { describe, expect, it } from "bun:test";
import { projectApiPaths } from "@webmux/api-contract";
import { legacyRuntimeEventsPath, mountProjectRoutes } from "../domain/project-routes";

describe("mountProjectRoutes", () => {
  it("mounts every project route under /api/projects/<prefix>, WebSockets included", () => {
    const mounted = mountProjectRoutes("webmux", {
      [projectApiPaths.fetchWorktrees]: "worktrees",
      [projectApiPaths.streamTerminal]: "terminal-ws",
      [projectApiPaths.streamAgentsWorktreeConversation]: "agents-ws",
    });

    expect(mounted).toEqual({
      "/api/projects/webmux/worktrees": "worktrees",
      "/api/projects/webmux/ws/:worktree": "terminal-ws",
      "/api/projects/webmux/ws/agents/worktrees/:name": "agents-ws",
    });
  });

  it("aliases the legacy runtime-events path to the same handler", () => {
    const handler = (): string => "runtime-events";
    const mounted = mountProjectRoutes("webmux", { [projectApiPaths.postRuntimeEvent]: handler });

    expect(mounted["/api/projects/webmux/runtime/events"]).toBe(handler);
    expect(mounted[legacyRuntimeEventsPath("webmux")]).toBe(handler);
    expect(legacyRuntimeEventsPath("webmux")).toBe("/webmux/api/runtime/events");
  });

  it("adds no legacy alias when the project has no runtime-events route", () => {
    expect(Object.keys(mountProjectRoutes("webmux", { "/config": 1 }))).toEqual(["/api/projects/webmux/config"]);
  });
});
