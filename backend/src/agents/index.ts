import type { AgentKind } from "../domain/config";
import { claudeAdapter } from "./claude";
import { codexAdapter } from "./codex";
import { opencodeAdapter } from "./opencode";
import { piAdapter } from "./pi";
import type { AgentAdapter } from "./types";

/** Adding a built-in agent = a new file in this directory + one line here (+ the AgentKind union). */
export const AGENT_ADAPTERS = {
  claude: claudeAdapter,
  codex: codexAdapter,
  opencode: opencodeAdapter,
  pi: piAdapter,
} as const satisfies Record<AgentKind, AgentAdapter>;

export function getAgentAdapter(kind: AgentKind): AgentAdapter {
  return AGENT_ADAPTERS[kind];
}

/** Built-in agent kinds in preference order (the order `AGENT_ADAPTERS` lists them in). */
export const AGENT_KINDS = Object.keys(AGENT_ADAPTERS) as AgentKind[];

export function isAgentKind(value: unknown): value is AgentKind {
  return typeof value === "string" && Object.hasOwn(AGENT_ADAPTERS, value);
}
