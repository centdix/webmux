import type { AgentKind } from "../domain/config";

export interface AgentCapabilities {
  terminal: true;
  inAppChat: boolean;
  conversationHistory: boolean;
  interrupt: boolean;
  resume: boolean;
}

/** Everything that differs between built-in agents lives behind this interface, one
 *  implementation per file in this directory. Register a new one in `./index.ts`. */
export interface AgentAdapter {
  id: AgentKind;
  label: string;
  capabilities: AgentCapabilities;
  /** Conversation backend the dashboard chat runs on, or null when the agent has none. */
  chatProvider: "claude" | "codex" | null;
  /** Whether a forked child can be launched with a session id we generate (see `pinSessionId`). */
  supportsPinnedSessionId: boolean;
}
