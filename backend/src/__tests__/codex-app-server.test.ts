import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CodexAppServerClient,
  type CodexAppServerNotification,
  parseCodexAppServerThreadItem,
  parseCodexAppServerThreadReadResponse,
} from "../adapters/codex-app-server";

describe("codex app-server adapter", () => {
  it("parses app-server tool thread items", () => {
    expect(parseCodexAppServerThreadItem({
      type: "mcpToolCall",
      id: "mcp-1",
      server: "linear",
      tool: "get_issue",
      status: "completed",
      arguments: { issueId: "ENG-123" },
      pluginId: null,
      result: {
        content: [{ type: "text", text: "Issue title" }],
        structuredContent: null,
        _meta: null,
      },
      error: null,
      durationMs: 25,
    })?.type).toBe("mcpToolCall");

    expect(parseCodexAppServerThreadItem({
      type: "fileChange",
      id: "patch-1",
      status: "completed",
      changes: [
        {
          path: "README.md",
          kind: { type: "update", move_path: null },
          diff: "--- a/README.md\n+++ b/README.md\n",
        },
      ],
    })?.type).toBe("fileChange");
  });

  it("keeps parsing partially modeled app-server items", () => {
    expect(parseCodexAppServerThreadItem({
      type: "agentMessage",
      id: "assistant-null-phase",
      text: "Hello",
      phase: null,
      memoryCitation: null,
    })).toEqual({
      type: "agentMessage",
      id: "assistant-null-phase",
      text: "Hello",
      phase: null,
      memoryCitation: null,
    });

    expect(parseCodexAppServerThreadItem({
      type: "newFutureItem",
      id: "future-1",
      nested: {
        unsupported: true,
      },
    })).toEqual({
      type: "newFutureItem",
      id: "future-1",
    });
  });

  it("keeps parsing thread reads with future turn statuses", () => {
    const parsed = parseCodexAppServerThreadReadResponse({
      thread: {
        id: "thread-1",
        forkedFromId: null,
        preview: "Run checks",
        ephemeral: false,
        modelProvider: "openai",
        createdAt: 1,
        updatedAt: 2,
        status: { type: "active" },
        path: "/tmp/worktree",
        cwd: "/tmp/worktree",
        cliVersion: "1.0.0",
        source: "cli",
        agentNickname: null,
        agentRole: null,
        gitInfo: null,
        name: null,
        turns: [{
          id: "turn-1",
          status: "running",
          error: null,
          startedAt: 1,
          completedAt: null,
          durationMs: null,
          items: [],
        }],
      },
    });

    expect(parsed?.thread.turns[0]?.status).toBe("running");
  });
});

const THREAD = {
  id: "thread-1",
  forkedFromId: null,
  preview: "",
  ephemeral: false,
  modelProvider: "openai",
  createdAt: 1,
  updatedAt: 2,
  status: { type: "idle" },
  path: null,
  cwd: "/tmp/worktree",
  cliVersion: "1.0.0",
  source: "vscode",
  agentNickname: null,
  agentRole: null,
  gitInfo: null,
  name: null,
  turns: [],
};

interface FakeServer {
  socketPath: string;
  methods: string[];
  extensionsHeaders: Array<string | null>;
  notify: (method: string, params: unknown) => void;
  stop: () => void;
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function startFakeAppServer(): Promise<FakeServer> {
  const dir = await mkdtemp(join(tmpdir(), "cx-test-"));
  const socketPath = join(dir, "app.sock");
  const methods: string[] = [];
  const extensionsHeaders: Array<string | null> = [];
  const sockets = new Set<Bun.ServerWebSocket<undefined>>();
  const server = Bun.serve({
    unix: socketPath,
    fetch(req, srv) {
      extensionsHeaders.push(req.headers.get("sec-websocket-extensions"));
      return srv.upgrade(req) ? undefined : new Response("upgrade required", { status: 400 });
    },
    websocket: {
      open(ws) {
        sockets.add(ws);
      },
      close(ws) {
        sockets.delete(ws);
      },
      message(ws, raw) {
        const message: { id?: number; method: string } = JSON.parse(String(raw));
        methods.push(message.method);
        if (message.id === undefined) return;
        const results: Record<string, unknown> = {
          initialize: { userAgent: "codex", codexHome: "/tmp", platformFamily: "unix", platformOs: "linux" },
          "thread/loaded/list": { data: ["thread-1"], nextCursor: null },
          "thread/resume": {
            thread: THREAD,
            model: "gpt",
            modelProvider: "openai",
            serviceTier: null,
            cwd: "/tmp/worktree",
            approvalPolicy: "never",
            approvalsReviewer: "user",
            sandbox: { type: "dangerFullAccess" },
            reasoningEffort: null,
          },
        };
        ws.send(JSON.stringify({ id: message.id, result: results[message.method] ?? {} }));
      },
    },
  });
  const fake: FakeServer = {
    socketPath,
    methods,
    extensionsHeaders,
    notify: (method, params) => {
      for (const ws of sockets) ws.send(JSON.stringify({ method, params }));
    },
    stop: () => {
      server.stop(true);
    },
  };
  cleanups.push(async () => {
    server.stop(true);
    await rm(dir, { recursive: true, force: true });
  });
  return fake;
}

describe("CodexAppServerClient", () => {
  it("talks JSON-RPC over a WebSocket on the worktree's unix socket", async () => {
    const fake = await startFakeAppServer();
    const client = new CodexAppServerClient({ socketPath: fake.socketPath, clientName: "test", clientVersion: "0" });
    const notifications: CodexAppServerNotification[] = [];
    client.onNotification((notification) => notifications.push(notification));

    expect(await client.threadLoadedList()).toEqual({ data: ["thread-1"], nextCursor: null });
    expect(client.isSubscribed("thread-1")).toBe(false);
    await client.threadResume({ threadId: "thread-1" });
    expect(client.isSubscribed("thread-1")).toBe(true);

    fake.notify("turn/started", { threadId: "thread-1" });
    await Bun.sleep(20);

    expect(fake.methods).toEqual(["initialize", "initialized", "thread/loaded/list", "thread/resume"]);
    expect(fake.extensionsHeaders).toEqual([null]);
    expect(notifications).toEqual([{ method: "turn/started", params: { threadId: "thread-1" } }]);
  });

  it("forgets subscriptions and reconnects after the server goes away", async () => {
    const fake = await startFakeAppServer();
    const client = new CodexAppServerClient({ socketPath: fake.socketPath, clientName: "test", clientVersion: "0" });
    let disconnects = 0;
    client.onDisconnect(() => {
      disconnects += 1;
    });

    await client.threadResume({ threadId: "thread-1" });
    fake.stop();
    await Bun.sleep(50);

    expect(disconnects).toBe(1);
    expect(client.isSubscribed("thread-1")).toBe(false);
    await expect(client.threadLoadedList()).rejects.toThrow("Codex app-server is not reachable");
  });
});
