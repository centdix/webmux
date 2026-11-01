import { describe, expect, it } from "bun:test";
import type { CustomAgents } from "../domain/config";
import {
  getAgentDefinition,
  isBuiltInAgentId,
  listAgentDefinitions,
  listAgentDetails,
  listAgentSummaries,
  normalizeCustomAgentId,
} from "../services/agent-registry";

const CUSTOM_AGENTS: CustomAgents = {
  gemini: {
    label: "Gemini CLI",
    startCommand: 'gemini --prompt "${PROMPT}"',
    resumeCommand: "gemini resume --last",
  },
};

describe("agent-registry", () => {
  it("lists built-in agents before custom agents", () => {
    expect(listAgentDefinitions(CUSTOM_AGENTS).map((agent) => agent.id)).toEqual(["claude", "codex", "opencode", "pi", "gemini"]);
  });

  it("exposes custom agents as terminal-only summaries", () => {
    expect(listAgentSummaries(CUSTOM_AGENTS)).toEqual([
      {
        id: "claude",
        label: "Claude",
        kind: "builtin",
        capabilities: {
          terminal: true,
          inAppChat: true,
          conversationHistory: true,
          interrupt: true,
          resume: true,
        },
      },
      {
        id: "codex",
        label: "Codex",
        kind: "builtin",
        capabilities: {
          terminal: true,
          inAppChat: true,
          conversationHistory: true,
          interrupt: true,
          resume: true,
        },
      },
      {
        id: "opencode",
        label: "opencode",
        kind: "builtin",
        capabilities: {
          terminal: true,
          inAppChat: false,
          conversationHistory: false,
          interrupt: false,
          resume: true,
        },
      },
      {
        id: "pi",
        label: "pi",
        kind: "builtin",
        capabilities: {
          terminal: true,
          inAppChat: false,
          conversationHistory: false,
          interrupt: false,
          resume: true,
        },
      },
      {
        id: "gemini",
        label: "Gemini CLI",
        kind: "custom",
        capabilities: {
          terminal: true,
          inAppChat: false,
          conversationHistory: false,
          interrupt: false,
          resume: true,
        },
      },
    ]);
  });

  it("ignores custom agents that collide with built-in ids", () => {
    const definitions = listAgentDefinitions({
      ...CUSTOM_AGENTS,
      claude: {
        label: "Override",
        startCommand: "custom-claude",
      },
    });

    expect(definitions.map((agent) => agent.id)).toEqual(["claude", "codex", "opencode", "pi", "gemini"]);
    expect(definitions[0]?.label).toBe("Claude");
  });

  it("resolves built-in and custom agent definitions by id", () => {
    const claude = getAgentDefinition(CUSTOM_AGENTS, "claude");
    const gemini = getAgentDefinition(CUSTOM_AGENTS, "gemini");
    const missing = getAgentDefinition(CUSTOM_AGENTS, "missing");

    expect(claude?.kind).toBe("builtin");
    expect(gemini?.kind).toBe("custom");
    expect(gemini?.implementation.type).toBe("custom");
    expect(missing).toBeNull();
  });

  it("exposes agent details for settings screens", () => {
    expect(listAgentDetails(CUSTOM_AGENTS)).toEqual([
      {
        id: "claude",
        label: "Claude",
        kind: "builtin",
        capabilities: {
          terminal: true,
          inAppChat: true,
          conversationHistory: true,
          interrupt: true,
          resume: true,
        },
        startCommand: null,
        resumeCommand: null,
      },
      {
        id: "codex",
        label: "Codex",
        kind: "builtin",
        capabilities: {
          terminal: true,
          inAppChat: true,
          conversationHistory: true,
          interrupt: true,
          resume: true,
        },
        startCommand: null,
        resumeCommand: null,
      },
      {
        id: "opencode",
        label: "opencode",
        kind: "builtin",
        capabilities: {
          terminal: true,
          inAppChat: false,
          conversationHistory: false,
          interrupt: false,
          resume: true,
        },
        startCommand: null,
        resumeCommand: null,
      },
      {
        id: "pi",
        label: "pi",
        kind: "builtin",
        capabilities: {
          terminal: true,
          inAppChat: false,
          conversationHistory: false,
          interrupt: false,
          resume: true,
        },
        startCommand: null,
        resumeCommand: null,
      },
      {
        id: "gemini",
        label: "Gemini CLI",
        kind: "custom",
        capabilities: {
          terminal: true,
          inAppChat: false,
          conversationHistory: false,
          interrupt: false,
          resume: true,
        },
        startCommand: 'gemini --prompt "${PROMPT}"',
        resumeCommand: "gemini resume --last",
      },
    ]);
  });

  it("normalizes custom agent ids and detects built-ins", () => {
    expect(normalizeCustomAgentId("Gemini CLI")).toBe("gemini-cli");
    expect(normalizeCustomAgentId("!!!")).toBe("agent");
    expect(isBuiltInAgentId("claude")).toBe(true);
    expect(isBuiltInAgentId("gemini")).toBe(false);
  });
});
