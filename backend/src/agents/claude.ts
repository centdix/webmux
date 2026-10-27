import type { AgentAdapter } from "./types";

export const claudeAdapter: AgentAdapter = {
  id: "claude",
  label: "Claude",
  capabilities: {
    terminal: true,
    inAppChat: true,
    conversationHistory: true,
    interrupt: true,
    resume: true,
  },
  chatProvider: "claude",
  supportsPinnedSessionId: true,
};
