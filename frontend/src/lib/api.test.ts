import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppNotification, InitialProject } from "./types";

/**
 * Every project-scoped call names its project explicitly — `api.ts` holds no
 * "active project". Regression guard for the WebSocket / upload / SSE URLs,
 * which must be scoped under `/api/projects/<prefix>` like every other request.
 */
async function loadApi(): Promise<typeof import("./api")> {
  vi.resetModules();
  return import("./api");
}

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("project-scoped network calls", () => {
  function stubWebSocket(): string[] {
    const urls: string[] = [];
    class MockWebSocket {
      constructor(url: string) {
        urls.push(url);
      }
      addEventListener(): void {}
      close(): void {}
    }
    vi.stubGlobal("WebSocket", MockWebSocket);
    return urls;
  }

  it("targets each project's own base path through the same module (no hidden global)", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request) => jsonResponse({ worktrees: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const urls = stubWebSocket();

    const api = await loadApi();
    await api.fetchWorktrees("alpha");
    await api.fetchWorktrees("beta");
    await api.fetchWorktrees("alpha");
    api.connectWorktreeConversationStream("beta", "feat/x", { onEvent: () => {}, onError: () => {} });
    api.connectWorktreeConversationStream("alpha", "feat/x", { onEvent: () => {}, onError: () => {} });

    expect(fetchMock.mock.calls.map(([input]) => urlOf(input))).toEqual([
      "/api/projects/alpha/worktrees",
      "/api/projects/beta/worktrees",
      "/api/projects/alpha/worktrees",
    ]);
    expect(urls).toEqual([
      `ws://${window.location.host}/api/projects/beta/ws/agents/worktrees/feat%2Fx`,
      `ws://${window.location.host}/api/projects/alpha/ws/agents/worktrees/feat%2Fx`,
    ]);
    expect(api.projectApi("alpha")).toBe(api.projectApi("alpha"));
    expect(api.projectApi("alpha")).not.toBe(api.projectApi("beta"));
    expect(window.location.pathname).toBe("/");
  });

  it("terminalSocketUrl points at the project's terminal socket", async () => {
    const api = await loadApi();

    expect(api.terminalSocketUrl("myproject", "feat/x")).toBe(
      `ws://${window.location.host}/api/projects/myproject/ws/feat%2Fx`,
    );
  });

  it("uploadFiles posts under the given project", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ uploaded: [], dir: "x" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const api = await loadApi();
    await api.uploadFiles("myproject", "feat/x", [new File(["a"], "a.txt")]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/myproject/worktrees/feat%2Fx/upload",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

describe("setUpProject", () => {
  it("returns the prefix immediately when the repo is already a project", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      jsonResponse({
        initializing: false,
        path: "/repo/y",
        project: { prefix: "y", name: "Y", path: "/repo/y", active: false },
      }),
    ));

    const api = await loadApi();
    const phases: string[] = [];
    const result = await api.setUpProject("/repo/y", (phase) => phases.push(phase));

    expect(result).toEqual({ prefix: "y" });
    expect(phases).toEqual([]); // no setup needed → no phases
  });

  it("polls the setup tracker and resolves with the prefix when ready", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = urlOf(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/api/projects") && method === "POST") {
        return jsonResponse({ initializing: true, path: "/repo/x", project: null });
      }
      if (url.endsWith("/api/projects/init")) {
        return jsonResponse({
          inits: [{ path: "/repo/x", phase: "ready", prefix: "x", name: "X", error: null }],
        });
      }
      throw new Error(`unexpected ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = await loadApi();
    const phases: string[] = [];
    const result = await api.setUpProject("/repo/x", (phase) => phases.push(phase));

    expect(result).toEqual({ prefix: "x" });
    expect(phases).toEqual(["ready"]);
  });

  it("rejects with the server error when setup fails", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = urlOf(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/api/projects") && method === "POST") {
        return jsonResponse({ initializing: true, path: "/repo/z", project: null });
      }
      return jsonResponse({
        inits: [{ path: "/repo/z", phase: "failed", prefix: null, name: null, error: "not a git repo" }],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = await loadApi();
    await expect(api.setUpProject("/repo/z", () => {})).rejects.toThrow("not a git repo");
  });
});

describe("notifications", () => {
  type Listener = (e: MessageEvent) => void;

  function stubEventSource(): { urls: string[]; emit: (event: string, data: unknown) => void } {
    const urls: string[] = [];
    const listeners = new Map<string, Listener>();
    class MockEventSource {
      constructor(url: string) {
        urls.push(url);
      }
      addEventListener(event: string, listener: Listener): void {
        listeners.set(event, listener);
      }
      close(): void {}
    }
    vi.stubGlobal("EventSource", MockEventSource);
    return {
      urls,
      emit: (event, data) => listeners.get(event)?.(new MessageEvent(event, { data: JSON.stringify(data) })),
    };
  }

  function notification(project: string, id: number): AppNotification {
    return { id, project, branch: "main", type: "agent_stopped", message: "Agent stopped on main", timestamp: 1 };
  }

  it("subscribeNotifications opens the hub stream", async () => {
    const source = stubEventSource();
    const api = await loadApi();
    api.subscribeNotifications("myproject", () => {}, () => {});

    expect(source.urls).toEqual(["/api/notifications/stream"]);
  });

  it("subscribeNotifications only delivers the given project's events", async () => {
    const source = stubEventSource();
    const api = await loadApi();
    const initial: AppNotification[] = [];
    const live: AppNotification[] = [];
    const dismissed: number[] = [];
    api.subscribeNotifications("myproject", (n) => live.push(n), (id) => dismissed.push(id), (n) => initial.push(n));

    source.emit("initial", notification("other", 1));
    source.emit("initial", notification("myproject", 2));
    source.emit("notification", notification("other", 3));
    source.emit("notification", notification("myproject", 4));
    source.emit("dismiss", { project: "other", id: 4 });
    source.emit("dismiss", { project: "myproject", id: 2 });

    expect(initial.map((n) => n.id)).toEqual([2]);
    expect(live.map((n) => n.id)).toEqual([4]);
    expect(dismissed).toEqual([2]);
  });

  it("dismissNotification posts to the notification's own project", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const api = await loadApi();
    await api.dismissNotification(notification("other", 7));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/other/notifications/7/dismiss",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("resolveInitialProject", () => {
  function stubProjects(prefixes: string[]): void {
    const projects = prefixes.map((prefix) => ({ prefix, name: prefix, path: `/repos/${prefix}`, active: false }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ projects }), { headers: { "content-type": "application/json" } })),
    );
  }

  async function resolve(): Promise<InitialProject> {
    return (await loadApi()).resolveInitialProject();
  }

  it("prefers the hash project, then the last project, then the first one", async () => {
    stubProjects(["alpha", "beta", "gamma"]);
    localStorage.setItem("wt-last-project", "beta");

    window.history.replaceState(null, "", "/#gamma/feat/x");
    expect(await resolve()).toEqual({ kind: "project", prefix: "gamma" });

    window.history.replaceState(null, "", "/");
    expect(await resolve()).toEqual({ kind: "project", prefix: "beta" });

    localStorage.clear();
    expect(await resolve()).toEqual({ kind: "project", prefix: "alpha" });
  });

  it("reports none when no project is registered", async () => {
    stubProjects([]);

    expect(await resolve()).toEqual({ kind: "none" });
  });

  it("reports an error instead of none when the list fails to load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "boom" }), { status: 500, headers: { "content-type": "application/json" } })),
    );

    expect((await resolve()).kind).toBe("error");
  });
});
