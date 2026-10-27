import { dirname, join } from "node:path";
import { quoteShell } from "./shared";
import type { AgentAdapter, BuiltInLaunchInput } from "./types";

const PI_EXTENSION_FILENAME = "webmux-pi-extension.js";

/** The pi extension lives in the webmux storage dir next to `webmux-agentctl`, and is loaded
 *  with `pi -e`, so nothing is written into the worktree. */
export function piExtensionPath(webmuxDir: string): string {
  return join(webmuxDir, PI_EXTENSION_FILENAME);
}

/** pi has no permission prompts, so `yolo` needs no flag. The webmux extension is loaded
 *  with `-e` from the storage dir that holds `runtimeEnvPath` (reachable in containers too). */
function buildPiInvocation(input: BuiltInLaunchInput): string {
  const extension = ` -e ${quoteShell(piExtensionPath(dirname(input.runtimeEnvPath)))}`;
  const systemPrompt = input.systemPrompt ? ` --append-system-prompt ${quoteShell(input.systemPrompt)}` : "";
  const promptArg = input.prompt ? ` ${quoteShell(input.prompt)}` : "";
  const pin = input.pinSessionId ? ` --session-id ${quoteShell(input.pinSessionId)}` : "";

  let session = pin;
  if (input.launchMode === "fork" && input.forkFromSessionId) {
    // `--fork` copies the session into a new one; `--session-id` names that new session.
    session = ` --fork ${quoteShell(input.forkFromSessionId)}${pin}`;
  } else if (input.launchMode === "resume") {
    session = input.resumeConversationId ? ` --session ${quoteShell(input.resumeConversationId)}` : " --continue";
  }
  return `pi${extension}${systemPrompt}${session}${promptArg}`;
}

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
  buildCommand: buildPiInvocation,
};
