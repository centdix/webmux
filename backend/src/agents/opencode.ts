import type { AgentAdapter } from "./types";

export const opencodeAdapter: AgentAdapter = {
  id: "opencode",
  label: "opencode",
  capabilities: {
    terminal: true,
    // opencode keeps its transcripts in its own database rather than on-disk session
    // files, so dashboard chat has no history to read yet — the terminal is the surface.
    inAppChat: false,
    conversationHistory: false,
    interrupt: false,
    resume: true,
  },
  chatProvider: null,
  supportsPinnedSessionId: false,
};
