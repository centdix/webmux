import { quoteShell } from "./shared";
import type { AgentAdapter, BuiltInLaunchInput } from "./types";

function buildCodexInvocation(input: BuiltInLaunchInput): string {
  const promptSuffix = input.prompt ? ` -- ${quoteShell(input.prompt)}` : "";
  const hooksFlag = " --enable hooks";
  const yoloFlag = input.yolo ? " --yolo" : "";
  if (input.launchMode === "fork" && input.forkFromSessionId) {
    // `codex fork <id>` branches the session into a fresh one with inherited history.
    return `codex${hooksFlag}${yoloFlag} fork ${quoteShell(input.forkFromSessionId)}${promptSuffix}`;
  }
  if (input.launchMode === "resume") {
    // `codex resume --last` takes the prompt after `--`, so a follow-up is
    // processed before the TUI starts — no paste/Enter race.
    const resumeTarget = input.resumeConversationId ? ` ${quoteShell(input.resumeConversationId)}` : " --last";
    return `codex${hooksFlag}${yoloFlag} resume${resumeTarget}${promptSuffix}`;
  }
  if (input.systemPrompt) {
    return `codex${hooksFlag}${yoloFlag} -c ${quoteShell(`developer_instructions=${input.systemPrompt}`)}${promptSuffix}`;
  }
  return `codex${hooksFlag}${yoloFlag}${promptSuffix}`;
}

export const codexAdapter: AgentAdapter = {
  id: "codex",
  label: "Codex",
  capabilities: {
    terminal: true,
    inAppChat: true,
    conversationHistory: true,
    interrupt: true,
    resume: true,
  },
  chatProvider: "codex",
  supportsPinnedSessionId: false,
  buildCommand: buildCodexInvocation,
};
