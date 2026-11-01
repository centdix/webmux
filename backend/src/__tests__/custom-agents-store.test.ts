import { describe, expect, it } from "bun:test";
import type { CustomAgents } from "../domain/config";
import { CustomAgentsStore } from "../services/custom-agents-store";

function makeStore(agents: CustomAgents = {}): { store: CustomAgentsStore; writes: CustomAgents[] } {
  const writes: CustomAgents[] = [];
  const store = new CustomAgentsStore({
    path: "/fake/config.yaml",
    agents,
    write: async (path, next) => {
      expect(path).toBe("/fake/config.yaml");
      writes.push(next);
    },
  });
  return { store, writes };
}

describe("CustomAgentsStore", () => {
  it("creates an agent under its normalized id, persists it, and lists it with the built-ins", async () => {
    const { store, writes } = makeStore();

    const result = await store.create({ label: "Gemini CLI", startCommand: "gemini", resumeCommand: "  " });

    expect(result).toEqual({
      ok: true,
      data: {
        id: "gemini-cli",
        label: "Gemini CLI",
        kind: "custom",
        capabilities: { terminal: true, inAppChat: false, conversationHistory: false, interrupt: false, resume: false },
        startCommand: "gemini",
        resumeCommand: null,
      },
    });
    expect(writes).toEqual([{ "gemini-cli": { label: "Gemini CLI", startCommand: "gemini" } }]);
    expect(store.list()).toEqual({ "gemini-cli": { label: "Gemini CLI", startCommand: "gemini" } });
    expect(store.details().map((agent) => agent.id)).toEqual(["claude", "codex", "opencode", "pi", "gemini-cli"]);
  });

  it("rejects creating an agent that collides with a built-in or existing id", async () => {
    const { store, writes } = makeStore({ gemini: { label: "Gemini", startCommand: "gemini" } });

    expect(await store.create({ label: "Claude", startCommand: "x" }))
      .toEqual({ ok: false, status: 409, error: "Agent already exists: claude" });
    expect(await store.create({ label: "Gemini", startCommand: "x" }))
      .toEqual({ ok: false, status: 409, error: "Agent already exists: gemini" });
    expect(writes).toEqual([]);
  });

  it("updates an existing agent in place", async () => {
    const { store, writes } = makeStore({ gemini: { label: "Gemini", startCommand: "gemini" } });

    const result = await store.update("gemini", { label: "Gemini 2", startCommand: "gemini2", resumeCommand: "gemini2 resume" });

    expect(result.ok).toBe(true);
    expect(store.list()).toEqual({ gemini: { label: "Gemini 2", startCommand: "gemini2", resumeCommand: "gemini2 resume" } });
    expect(writes).toHaveLength(1);
  });

  it("refuses to update or delete built-in and unknown agents", async () => {
    const { store, writes } = makeStore();

    expect(await store.update("claude", { label: "x", startCommand: "x" }))
      .toEqual({ ok: false, status: 400, error: "Built-in agent cannot be edited: claude" });
    expect(await store.update("missing", { label: "x", startCommand: "x" }))
      .toEqual({ ok: false, status: 404, error: "Unknown agent: missing" });
    expect(await store.remove("claude"))
      .toEqual({ ok: false, status: 400, error: "Built-in agent cannot be deleted: claude" });
    expect(await store.remove("missing"))
      .toEqual({ ok: false, status: 404, error: "Unknown agent: missing" });
    expect(writes).toEqual([]);
  });

  it("removes an agent", async () => {
    const { store, writes } = makeStore({ gemini: { label: "Gemini", startCommand: "gemini" } });

    expect(await store.remove("gemini")).toEqual({ ok: true, data: null });
    expect(store.list()).toEqual({});
    expect(writes).toEqual([{}]);
  });

  it("keeps the previous agents when the write fails", async () => {
    const store = new CustomAgentsStore({
      path: "/fake/config.yaml",
      agents: {},
      write: async () => {
        throw new Error("read-only");
      },
    });

    await expect(store.create({ label: "Gemini", startCommand: "gemini" })).rejects.toThrow("read-only");
    expect(store.list()).toEqual({});
  });
});
