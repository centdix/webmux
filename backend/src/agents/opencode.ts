import { join } from "node:path";
import { quoteShell } from "./shared";
import type { AgentAdapter, BuiltInLaunchInput } from "./types";

/** File the opencode launch command writes the profile system prompt to, referenced from
 *  `OPENCODE_CONFIG_CONTENT.instructions` because opencode has no `--append-system-prompt`. */
export function opencodeInstructionsPath(worktreePath: string): string {
  return join(worktreePath, ".opencode", "webmux-instructions.md");
}

/** opencode has no `--append-system-prompt`: the only way to add instructions to a launch is
 *  to point the resolved config at an extra instructions file, so the launch writes one.
 *  `OPENCODE_CONFIG_CONTENT` is merged over the user's own opencode config. */
function buildOpencodeInstructionsPrefix(systemPrompt: string, worktreePath: string): string {
  const instructionsPath = opencodeInstructionsPath(worktreePath);
  const inlineConfig = JSON.stringify({ instructions: [instructionsPath] });
  return `printf '%s' ${quoteShell(systemPrompt)} > ${quoteShell(instructionsPath)}; `
    + `OPENCODE_CONFIG_CONTENT=${quoteShell(inlineConfig)} `;
}

function buildOpencodeInvocation(input: BuiltInLaunchInput): string {
  const prefix = input.systemPrompt
    ? buildOpencodeInstructionsPrefix(input.systemPrompt, input.worktreePath)
    : "";
  // `--auto` approves every permission that isn't explicitly denied by the user's config.
  const autoFlag = input.yolo ? " --auto" : "";
  // `--prompt` is submitted as the first turn while the TUI boots, so there is no
  // paste/Enter race — the same reason claude and codex take the prompt on the CLI.
  const promptFlag = input.prompt ? ` --prompt ${quoteShell(input.prompt)}` : "";

  if (input.launchMode === "fork" && input.forkFromSessionId) {
    // `--fork` copies the session's history into a brand new session.
    return `${prefix}opencode${autoFlag} --session ${quoteShell(input.forkFromSessionId)} --fork${promptFlag}`;
  }
  if (input.launchMode === "resume") {
    const resumeTarget = input.resumeConversationId
      ? ` --session ${quoteShell(input.resumeConversationId)}`
      : " --continue";
    return `${prefix}opencode${autoFlag}${resumeTarget}${promptFlag}`;
  }
  return `${prefix}opencode${autoFlag}${promptFlag}`;
}

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
  buildCommand: buildOpencodeInvocation,
};
