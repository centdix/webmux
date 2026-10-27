import type { AgentKind } from "../domain/config";

export interface AgentCapabilities {
  terminal: true;
  inAppChat: boolean;
  conversationHistory: boolean;
  interrupt: boolean;
  resume: boolean;
}

export type AgentLaunchMode = "fresh" | "resume" | "fork";

export interface BuiltInLaunchInput {
  yolo?: boolean;
  systemPrompt?: string;
  prompt?: string;
  worktreePath: string;
  runtimeEnvPath: string;
  launchMode?: AgentLaunchMode;
  resumeConversationId?: string;
  /** Session to fork from (launchMode "fork"): claude `--fork-session`, codex `fork`, opencode `--fork`, pi `--fork`. */
  forkFromSessionId?: string;
  /** Claude/pi: pin the forked child to a session id we generated, so we know it without disk discovery. */
  pinSessionId?: string;
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
  /** Shell command that launches the agent (without the runtime bootstrap). */
  buildCommand(input: BuiltInLaunchInput): string;
}
