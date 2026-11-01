import { describe, expect, it } from "bun:test";
import { hubApiPaths, projectApiBasePath, projectApiPaths } from "@webmux/api-contract";
import {
  assembleServeRoutes,
  isApiPath,
  legacyProjectRedirect,
  legacyRuntimeEventsPath,
  mountProjectRoutes,
} from "../domain/project-routes";

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

describe("assembleServeRoutes", () => {
  const allProjectRoutes = Object.fromEntries(Object.values(projectApiPaths).map((path) => [path, "project"]));
  const hubRoutes = Object.fromEntries(Object.values(hubApiPaths).map((path) => [path, "hub"]));
  const prefixes = ["webmux", "init", "worktrees", "migrate"];

  it("keeps every hub route alongside the mounted project routes", () => {
    const routes = assembleServeRoutes(hubRoutes, prefixes.map((prefix) => ({ prefix, routes: allProjectRoutes })));

    for (const path of Object.values(hubApiPaths)) expect(routes[path]).toBe("hub");
    expect(routes["/api/projects/webmux/worktrees"]).toBe("project");
  });

  it("never mounts a project route on a hub path or on the bare project base path", () => {
    const hubPaths = new Set<string>(Object.values(hubApiPaths));
    for (const prefix of prefixes) {
      for (const path of Object.keys(mountProjectRoutes(prefix, allProjectRoutes))) {
        expect(hubPaths.has(path)).toBe(false);
        expect(path).not.toBe(projectApiBasePath(prefix));
      }
    }
  });
});

describe("isApiPath", () => {
  it("matches /api, /api/... and legacy /<prefix>/api(/...) paths", () => {
    for (const path of ["/api", "/api/", "/api/nope", "/api/projects/webmux/x", "/webmux/api", "/webmux/api/worktrees"]) {
      expect(isApiPath(path)).toBe(true);
    }
  });

  it("leaves SPA and static asset paths alone", () => {
    for (const path of ["/", "/webmux", "/webmux/", "/apis", "/assets/api.js", "/webmux/apiary", "/a/b/api"]) {
      expect(isApiPath(path)).toBe(false);
    }
  });
});

describe("legacyProjectRedirect", () => {
  const isProject = (prefix: string): boolean => prefix === "webmux";

  it("sends old /<prefix> bookmarks to the project's hash", () => {
    for (const path of ["/webmux", "/webmux/", "/webmux/feat/x"]) {
      expect(legacyProjectRedirect(path, isProject)).toBe("/#webmux");
    }
  });

  it("leaves unknown prefixes, the root and API paths alone", () => {
    for (const path of ["/", "/other", "/other/feat", "/api/projects/webmux", "/webmux/api/worktrees", "/webmux/api"]) {
      expect(legacyProjectRedirect(path, isProject)).toBeNull();
    }
  });
});
