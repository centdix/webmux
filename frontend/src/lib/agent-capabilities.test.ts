import { describe, expect, it } from "vitest";
import { supportsWorktreeChat, supportsWorktreeTabs } from "./agent-capabilities";
import type { AgentSummary, WorktreeInfo } from "./types";

function agent(overrides: {
  id: string;
  kind: AgentSummary["kind"];
  inAppChat: boolean;
}): AgentSummary {
  return {
    id: overrides.id,
    label: overrides.id,
    kind: overrides.kind,
    capabilities: {
      terminal: true,
      inAppChat: overrides.inAppChat,
      conversationHistory: overrides.inAppChat,
      interrupt: overrides.inAppChat,
      resume: true,
    },
  };
}

const AGENTS: AgentSummary[] = [
  agent({ id: "claude", kind: "builtin", inAppChat: true }),
  agent({ id: "codex", kind: "builtin", inAppChat: true }),
  agent({ id: "opencode", kind: "builtin", inAppChat: false }),
  agent({ id: "gemini", kind: "custom", inAppChat: false }),
];

function worktree(agentName: string | null): WorktreeInfo {
  return {
    branch: "feature",
    label: null,
    archived: false,
    agent: "waiting",
    mux: "✓",
    path: "/repo/__worktrees/feature",
    dir: "/repo/__worktrees/feature",
    dirty: false,
    unpushed: false,
    status: "idle",
    elapsed: "1m",
    profile: null,
    agentName,
    agentLabel: agentName,
    agentTerminalStale: false,
    services: [],
    paneCount: 1,
    prs: [],
    linearIssue: null,
    creating: false,
    creationPhase: null,
    source: "ui",
    oneshot: null,
    tabs: [],
    activeTabId: null,
  };
}

describe("supportsWorktreeChat", () => {
  it("follows the agent's advertised chat capability", () => {
    expect(supportsWorktreeChat(AGENTS, worktree("claude"))).toBe(true);
    expect(supportsWorktreeChat(AGENTS, worktree("codex"))).toBe(true);
    expect(supportsWorktreeChat(AGENTS, worktree("opencode"))).toBe(false);
    expect(supportsWorktreeChat(AGENTS, worktree("gemini"))).toBe(false);
  });

  it("assumes only claude and codex chat before the agent list has loaded", () => {
    expect(supportsWorktreeChat([], worktree("claude"))).toBe(true);
    expect(supportsWorktreeChat([], worktree("opencode"))).toBe(false);
  });

  it("is false without an agent", () => {
    expect(supportsWorktreeChat(AGENTS, worktree(null))).toBe(false);
    expect(supportsWorktreeChat(AGENTS, undefined)).toBe(false);
  });
});

describe("supportsWorktreeTabs", () => {
  it("offers tabs for every built-in agent, including chat-less ones", () => {
    expect(supportsWorktreeTabs(AGENTS, worktree("claude"))).toBe(true);
    expect(supportsWorktreeTabs(AGENTS, worktree("opencode"))).toBe(true);
  });

  it("withholds tabs from custom agents and unknown or missing agents", () => {
    expect(supportsWorktreeTabs(AGENTS, worktree("gemini"))).toBe(false);
    expect(supportsWorktreeTabs(AGENTS, worktree("missing"))).toBe(false);
    expect(supportsWorktreeTabs(AGENTS, worktree(null))).toBe(false);
  });
});
