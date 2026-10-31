import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppNotification } from "./types";

/**
 * `apiBase` is derived from `window.location.pathname` at module load, so each
 * case sets the URL and re-imports `api.ts` fresh. Regression guard for the
 * notifications SSE + file-upload calls, which must be scoped under the active
 * project's `/api/projects/<prefix>` like every other request — otherwise they
 * fall through to the SPA and get `index.html` back instead of the real endpoint.
 */
async function loadApiAt(pathname: string): Promise<typeof import("./api")> {
  window.history.replaceState({}, "", pathname);
  vi.resetModules();
  return import("./api");
}

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("project-prefixed network calls", () => {
  it("derives apiBase from the first path segment", async () => {
    expect((await loadApiAt("/myproject/")).apiBase).toBe("/api/projects/myproject");
  });

  it("connectWorktreeConversationStream opens the agents socket under the active prefix", async () => {
    const urls: string[] = [];
    class MockWebSocket {
      constructor(url: string) {
        urls.push(url);
      }
      addEventListener(): void {}
      close(): void {}
    }
    vi.stubGlobal("WebSocket", MockWebSocket);

    const api = await loadApiAt("/myproject/");
    api.connectWorktreeConversationStream("feat/x", { onEvent: () => {}, onError: () => {} });

    expect(urls).toEqual([`ws://${window.location.host}/api/projects/myproject/ws/agents/worktrees/feat%2Fx`]);
  });

  it("terminalStreamUrl targets the terminal socket under the active prefix", async () => {
    const api = await loadApiAt("/myproject/");

    expect(api.terminalStreamUrl("feat/x")).toBe(`ws://${window.location.host}/api/projects/myproject/ws/feat%2Fx`);
  });

  it("uploadFiles posts under the active prefix", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ uploaded: [], dir: "x" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const api = await loadApiAt("/myproject/");
    await api.uploadFiles("feat/x", [new File(["a"], "a.txt")]);

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

    const api = await loadApiAt("/y/");
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

    const api = await loadApiAt("/x/");
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

    const api = await loadApiAt("/x/");
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
    const api = await loadApiAt("/myproject/");
    api.subscribeNotifications(() => {}, () => {});

    expect(source.urls).toEqual(["/api/notifications/stream"]);
  });

  it("subscribeNotifications only delivers the active project's events", async () => {
    const source = stubEventSource();
    const api = await loadApiAt("/myproject/");
    const initial: AppNotification[] = [];
    const live: AppNotification[] = [];
    const dismissed: number[] = [];
    api.subscribeNotifications((n) => live.push(n), (id) => dismissed.push(id), (n) => initial.push(n));

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

    const api = await loadApiAt("/myproject/");
    await api.dismissNotification(notification("other", 7));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/other/notifications/7/dismiss",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
