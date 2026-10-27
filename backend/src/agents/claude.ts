import { quoteShell } from "./shared";
import type { AgentAdapter, BuiltInLaunchInput } from "./types";

function buildClaudeInvocation(input: BuiltInLaunchInput): string {
  const promptSuffix = input.prompt ? ` -- ${quoteShell(input.prompt)}` : "";
  const yoloFlag = input.yolo ? " --dangerously-skip-permissions" : "";
  if (input.launchMode === "fork" && input.forkFromSessionId) {
    // Fork the parent into a NEW session, pinning the child id when provided so
    // the tab service can track it deterministically.
    const pin = input.pinSessionId ? ` --session-id ${quoteShell(input.pinSessionId)}` : "";
    return `claude${yoloFlag} --resume ${quoteShell(input.forkFromSessionId)} --fork-session${pin}${promptSuffix}`;
  }
  if (input.launchMode === "resume") {
    // `--resume <id>` restores a specific session (e.g. a fork on reopen); `--continue`
    // resumes the most recent. Either way the prompt is submitted as the first new turn,
    // avoiding the tmux paste/Enter race that hits Claude's TUI before its input loop is ready.
    const resumeTarget = input.resumeConversationId
      ? ` --resume ${quoteShell(input.resumeConversationId)}`
      : " --continue";
    return `claude${yoloFlag}${resumeTarget}${promptSuffix}`;
  }
  if (input.systemPrompt) {
    return `claude${yoloFlag} --append-system-prompt ${quoteShell(input.systemPrompt)}${promptSuffix}`;
  }
  return `claude${yoloFlag}${promptSuffix}`;
}

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
  buildCommand: buildClaudeInvocation,
};
