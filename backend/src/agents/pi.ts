import type { AgentAdapter } from "./types";

export const piAdapter: AgentAdapter = {
  id: "pi",
  label: "pi",
  capabilities: {
    terminal: true,
    // pi's session files aren't parsed into dashboard conversations yet — the terminal is the surface.
    inAppChat: false,
    conversationHistory: false,
    interrupt: false,
    resume: true,
  },
  chatProvider: null,
  supportsPinnedSessionId: true,
};
