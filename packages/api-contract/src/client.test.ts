import { describe, expect, it } from "bun:test";
import { createHubApi, createProjectApi } from "./client";

function success(body: unknown): { status: number; body: unknown; headers: Headers } {
  return {
    status: 200,
    body,
    headers: new Headers(),
  };
}

describe("createProjectApi", () => {
  it("encodes slash-containing path params before ts-rest interpolates them", async () => {
    const paths: string[] = [];
    const api = createProjectApi("myproject", {
      origin: "https://example.com",
      api: async ({ path }) => {
        paths.push(path);
        return success({ ok: true });
      },
    });

    await api.sendWorktreePrompt({
      params: { name: "feature/search" },
      body: { text: "Fix the failing tests" },
    });

    expect(paths).toEqual(["https://example.com/api/projects/myproject/worktrees/feature%2Fsearch/send"]);
  });

  it("preserves numeric path params for notification and CI routes", async () => {
    const paths: string[] = [];
    const api = createProjectApi("myproject", {
      origin: "https://example.com",
      api: async ({ path }) => {
        paths.push(path);
        if (path.endsWith("/dismiss")) {
          return success({ ok: true });
        }
        return success({ logs: "" });
      },
    });

    await api.dismissNotification({ params: { id: 42 } });
    await api.fetchCiLogs({ params: { runId: 317 } });

    expect(paths).toEqual([
      "https://example.com/api/projects/myproject/notifications/42/dismiss",
      "https://example.com/api/projects/myproject/ci-logs/317",
    ]);
  });

  it("throws API error messages from json error bodies", async () => {
    const api = createProjectApi("myproject", {
      origin: "https://example.com",
      api: async () => ({
        status: 404,
        body: { error: "Not found" },
        headers: new Headers(),
      }),
    });

    await expect(api.dismissNotification({ params: { id: 7 } })).rejects.toThrow("Not found");
  });

  it("throws API error messages from stringified json error bodies", async () => {
    const api = createProjectApi("myproject", {
      origin: "https://example.com",
      api: async () => ({
        status: 502,
        body: JSON.stringify({ error: "Gateway unavailable" }),
        headers: new Headers(),
      }),
    });

    await expect(api.fetchCiLogs({ params: { runId: 99 } })).rejects.toThrow("Gateway unavailable");
  });
});

describe("createProjectApi base path", () => {
  it("defaults to same-origin relative URLs and encodes the project segment", async () => {
    const paths: string[] = [];
    const api = createProjectApi("my project", {
      api: async ({ path }) => {
        paths.push(path);
        return success({ worktrees: [] });
      },
    });

    await api.fetchWorktrees();

    expect(paths).toEqual(["/api/projects/my%20project/worktrees"]);
  });
});

describe("createHubApi", () => {
  it("targets absolute hub paths on the given origin", async () => {
    const paths: string[] = [];
    const api = createHubApi({
      origin: "https://example.com",
      api: async ({ path }) => {
        paths.push(path);
        return success({ projects: [] });
      },
    });

    await api.fetchAllProjectWorktrees();
    await api.removeProject({ params: { prefix: "webmux" } });

    expect(paths).toEqual([
      "https://example.com/api/projects/worktrees",
      "https://example.com/api/projects/webmux",
    ]);
  });
});
