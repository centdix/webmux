import { describe, expect, it } from "bun:test";
import { createHubApi, createProjectApi } from "./client";
import { projectApiPaths } from "./contract";

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
      params: { id: "wt/1 a" },
      body: { text: "Fix the failing tests" },
    });

    expect(paths).toEqual(["https://example.com/api/projects/myproject/worktrees/wt%2F1%20a/send"]);
  });

  it("addresses worktree content routes by worktree id", async () => {
    const calls: string[] = [];
    const api = createProjectApi("myproject", {
      origin: "https://example.com",
      api: async ({ path, method }) => {
        calls.push(`${method} ${path}`);
        return path.endsWith("/tabs") ? { ...success({ tab: {} }), status: 201 } : success({ ok: true });
      },
    });
    const params = { id: "wt_1" };

    await api.sendWorktreePrompt({ params, body: { text: "hi" } });
    await api.createWorktreeTab({ params });
    await api.selectWorktreeTab({ params: { id: "wt_1", tabId: "fork-1" } });
    await api.deleteWorktreeTab({ params: { id: "wt_1", tabId: "fork-1" } });
    await api.registerWorktreePort({ params, body: { label: "web" } });
    await api.fetchWorktreePorts({ params });
    await api.deleteWorktreePort({ params: { id: "wt_1", label: "web" } });
    await api.fetchWorktreeDiff({ params });

    const base = "https://example.com/api/projects/myproject/worktrees/wt_1";
    expect(calls).toEqual([
      `POST ${base}/send`,
      `POST ${base}/tabs`,
      `POST ${base}/tabs/fork-1/select`,
      `DELETE ${base}/tabs/fork-1`,
      `POST ${base}/ports`,
      `GET ${base}/ports`,
      `DELETE ${base}/ports/web`,
      `GET ${base}/diff`,
    ]);
    expect(projectApiPaths.uploadWorktreeFiles).toBe("/worktrees/:id/upload");
    expect(projectApiPaths.streamTerminal).toBe("/ws/:id");
    expect(projectApiPaths.streamAgentsWorktreeConversation).toBe("/ws/agents/worktrees/:id");
    expect([
      projectApiPaths.attachAgentsWorktreeConversation,
      projectApiPaths.fetchAgentsWorktreeConversationHistory,
      projectApiPaths.sendAgentsWorktreeConversationMessage,
      projectApiPaths.interruptAgentsWorktreeConversation,
    ]).toEqual([
      "/agents/worktrees/:id/attach",
      "/agents/worktrees/:id/history",
      "/agents/worktrees/:id/messages",
      "/agents/worktrees/:id/interrupt",
    ]);
  });

  it("addresses worktree lifecycle routes by worktree id", async () => {
    const calls: string[] = [];
    const api = createProjectApi("myproject", {
      origin: "https://example.com",
      api: async ({ path, method }) => {
        calls.push(`${method} ${path}`);
        return success({ ok: true });
      },
    });
    const params = { id: "wt_1" };

    await api.removeWorktree({ params });
    await api.openWorktree({ params, body: {} });
    await api.closeWorktree({ params });
    await api.refreshWorktreeAgentTerminal({ params });
    await api.setWorktreeArchived({ params, body: { archived: true } });
    await api.syncWorktreePrs({ params });
    await api.postWorktreeToLinear({ params, body: { target: { kind: "team", teamKey: "ENG" } } });
    await api.setWorktreeLabel({ params, body: { label: null } });
    await api.setWorktreeProfile({ params, body: { profile: "full" } });
    await api.mergeWorktree({ params });

    const base = "https://example.com/api/projects/myproject/worktrees/wt_1";
    expect(calls).toEqual([
      `DELETE ${base}`,
      `POST ${base}/open`,
      `POST ${base}/close`,
      `POST ${base}/agent-terminal/refresh`,
      `PUT ${base}/archive`,
      `POST ${base}/sync-prs`,
      `POST ${base}/linear/post`,
      `PUT ${base}/label`,
      `PUT ${base}/profile`,
      `POST ${base}/merge`,
    ]);
    expect(projectApiPaths.fetchNativeTerminalLaunch).toBe("/worktrees/:id/terminal-launch");
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

  it("rejects a 2xx HTML response (SPA fallback of a server without the route)", async () => {
    const api = createProjectApi("myproject", {
      origin: "https://example.com",
      api: async () => ({
        status: 200,
        body: "<!doctype html><html></html>",
        headers: new Headers({ "content-type": "text/html;charset=utf-8" }),
      }),
    });

    await expect(api.fetchWorktrees()).rejects.toThrow("expected JSON, got HTML");
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
    await api.fetchAllProjectWorktrees({ query: { focus: "webmux" } });
    await api.removeProject({ params: { prefix: "webmux" } });

    expect(paths).toEqual([
      "https://example.com/api/projects/worktrees",
      "https://example.com/api/projects/worktrees?focus=webmux",
      "https://example.com/api/projects/webmux",
    ]);
  });

  it("serves the custom agent routes from the hub, outside any project", async () => {
    const calls: string[] = [];
    const agent = {
      id: "gemini",
      label: "Gemini",
      kind: "custom",
      capabilities: { terminal: true, inAppChat: false, conversationHistory: false, interrupt: false, resume: false },
      startCommand: "gemini",
      resumeCommand: null,
    };
    const api = createHubApi({
      origin: "https://example.com",
      api: async ({ path, method }) => {
        calls.push(`${method} ${path}`);
        if (path.endsWith("/validate")) return success({ normalizedId: "gemini", warnings: [] });
        if (method === "DELETE") return success({ ok: true });
        if (method === "GET") return success({ agents: [agent] });
        return success({ agent });
      },
    });
    const body = { label: "Gemini", startCommand: "gemini" };

    await api.fetchAgents();
    await api.createAgent({ body });
    await api.validateAgent({ body });
    await api.updateAgent({ params: { id: "gemini" }, body });
    await api.deleteAgent({ params: { id: "gemini" } });

    expect(calls).toEqual([
      "GET https://example.com/api/agents",
      "POST https://example.com/api/agents",
      "POST https://example.com/api/agents/validate",
      "PUT https://example.com/api/agents/gemini",
      "DELETE https://example.com/api/agents/gemini",
    ]);
  });
});
