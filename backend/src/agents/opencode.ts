import { join } from "node:path";
import { isRecord } from "../lib/type-guards";
import { newestFirst, quoteShell, type StampedSession } from "./shared";
import type { AgentAdapter, BuiltInLaunchInput } from "./types";

/** File the opencode launch command writes the profile system prompt to, referenced from
 *  `OPENCODE_CONFIG_CONTENT.instructions` because opencode has no `--append-system-prompt`. */
export function opencodeInstructionsPath(worktreePath: string): string {
  return join(worktreePath, ".opencode", "webmux-instructions.md");
}

/** Session ids the generated opencode plugin records, newest last. opencode keeps its
 *  transcripts in a database rather than per-session files, so this is what session
 *  discovery reads instead of scanning a well-known agent directory. */
export function opencodeSessionsPath(worktreePath: string): string {
  return join(worktreePath, ".opencode", "webmux-sessions.jsonl");
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

async function listOpencodeSessionIds(cwd: string): Promise<string[]> {
  const file = Bun.file(opencodeSessionsPath(cwd));
  const content = await file.text().catch((): string => "");
  const stamped = content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line): StampedSession | null => {
      try {
        const parsed: unknown = JSON.parse(line);
        if (!isRecord(parsed)) return null;
        const { id, at } = parsed;
        return typeof id === "string" && typeof at === "number" ? { sessionId: id, mtimeMs: at } : null;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is StampedSession => entry !== null);

  return newestFirst(stamped);
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
  listSessionIds: listOpencodeSessionIds,
};
