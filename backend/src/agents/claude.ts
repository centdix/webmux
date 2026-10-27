import { mkdir, readdir, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { encodeClaudeProjectDir } from "../adapters/claude-cli";
import { isRecord } from "../lib/type-guards";
import {
  closeAssistant,
  emitStatus,
  emitWarning,
  extractStructuredMessage,
  extractTextBlocks,
  home,
  type HookConfigFile,
  newestFirst,
  quoteShell,
  readString,
  type StampedSession,
  streamSnapshot,
} from "./shared";
import type {
  AgentAdapter,
  BuiltInLaunchInput,
  InitAgentCommandSpec,
  InitAgentStreamEvent,
  InitAgentStreamState,
  InitPromptSpec,
  RuntimeArtifactsContext,
} from "./types";

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

async function listClaudeSessionIds(cwd: string): Promise<string[]> {
  const dir = join(home(), ".claude", "projects", encodeClaudeProjectDir(cwd));
  const names = await readdir(dir).catch((): string[] => []);
  const stamped = await Promise.all(
    names
      .filter((name) => name.endsWith(".jsonl"))
      .map(async (name): Promise<StampedSession | null> => {
        const info = await stat(join(dir, name)).catch(() => null);
        return info ? { sessionId: basename(name, ".jsonl"), mtimeMs: info.mtimeMs } : null;
      }),
  );
  return newestFirst(stamped.filter((entry): entry is StampedSession => entry !== null));
}

export function claudeSettingsPath(worktreePath: string): string {
  return join(worktreePath, ".claude", "settings.local.json");
}

function buildClaudeHookSettings(input: { agentCtlPath: string }): HookConfigFile {
  return {
    hooks: {
      UserPromptSubmit: [
        {
          hooks: [
            {
              type: "command",
              command: `${quoteShell(input.agentCtlPath)} claude-user-prompt-submit`,
              async: true,
            },
          ],
        },
      ],
      Notification: [
        {
          matcher: "permission_prompt|elicitation_dialog",
          hooks: [
            {
              type: "command",
              command: `${quoteShell(input.agentCtlPath)} status-changed --lifecycle idle`,
              async: true,
            },
          ],
        },
      ],
      Stop: [
        {
          hooks: [
            {
              type: "command",
              command: `${quoteShell(input.agentCtlPath)} agent-stopped`,
              async: true,
            },
          ],
        },
      ],
      PostToolUse: [
        {
          hooks: [
            {
              type: "command",
              command: `${quoteShell(input.agentCtlPath)} status-changed --lifecycle running`,
              async: true,
            },
          ],
        },
        {
          matcher: "Bash",
          hooks: [
            {
              type: "command",
              command: `${quoteShell(input.agentCtlPath)} claude-post-tool-use`,
              async: true,
            },
          ],
        },
      ],
    },
  };
}

async function mergeClaudeSettings(
  settingsPath: string,
  hookSettings: HookConfigFile["hooks"],
): Promise<void> {
  let existing: Record<string, unknown> = {};

  try {
    const file = Bun.file(settingsPath);
    if (await file.exists()) {
      const parsed = await file.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        existing = parsed as Record<string, unknown>;
      }
    }
  } catch {
    existing = {};
  }

  const existingHooks = existing.hooks;
  const mergedHooks = existingHooks && typeof existingHooks === "object" && !Array.isArray(existingHooks)
    ? { ...existingHooks, ...hookSettings }
    : hookSettings;
  const merged = { ...existing, hooks: mergedHooks };
  await Bun.write(settingsPath, JSON.stringify(merged, null, 2) + "\n");
}

async function writeClaudeRuntimeArtifacts(ctx: RuntimeArtifactsContext): Promise<void> {
  const settingsPath = claudeSettingsPath(ctx.worktreePath);
  await mkdir(dirname(settingsPath), { recursive: true });
  const hooks = buildClaudeHookSettings(ctx).hooks;
  if (!isRecord(hooks)) {
    throw new Error("Invalid Claude hook settings");
  }
  await mergeClaudeSettings(settingsPath, hooks);
}

const FAST_CLAUDE_MODEL = "haiku";
const FAST_CLAUDE_EFFORT = "low";

function buildClaudeInitCommand(prompt: InitPromptSpec): InitAgentCommandSpec {
  return {
    agent: "claude",
    cmd: "claude",
    args: [
      "-p",
      "--verbose",
      "--permission-mode",
      "bypassPermissions",
      "--model",
      FAST_CLAUDE_MODEL,
      "--effort",
      FAST_CLAUDE_EFFORT,
      "--output-format",
      "stream-json",
      "--include-partial-messages",
      "--append-system-prompt",
      prompt.systemPrompt,
      prompt.userPrompt,
    ],
  };
}

function parseClaudeStreamLine(
  raw: Record<string, unknown>,
  state: InitAgentStreamState,
): InitAgentStreamEvent[] {
  const type = readString(raw.type) ?? "unknown";

  if (type === "content_block_delta" && isRecord(raw.delta)) {
    if (raw.delta.type === "text_delta" && typeof raw.delta.text === "string") {
      return [{ kind: "assistant_delta", text: raw.delta.text }];
    }
    if (typeof raw.delta.text === "string") {
      return [{ kind: "assistant_delta", text: raw.delta.text }];
    }
  }

  if (type === "content_block_start" && isRecord(raw.content_block)) {
    if (raw.content_block.type === "tool_use") {
      return emitStatus(state, `Using ${readString(raw.content_block.name) ?? "tool"}...`);
    }

    const snapshot = extractTextBlocks(raw.content_block).trim();
    return streamSnapshot(state, snapshot);
  }

  if (type === "message_stop" || type === "result_stop" || type === "content_block_stop") {
    return closeAssistant(state);
  }

  if (type === "error") {
    const message = isRecord(raw.error) ? readString(raw.error.message) : readString(raw.message);
    return emitWarning(state, message ?? "Claude returned an error.");
  }

  if (type.includes("tool")) {
    const toolName = readString(raw.tool_name)
      ?? (isRecord(raw.tool) ? readString(raw.tool.name) : null)
      ?? readString(raw.name);
    if (toolName) return emitStatus(state, `Using ${toolName}...`);
  }

  const snapshot = extractStructuredMessage(raw);
  if (snapshot) return streamSnapshot(state, snapshot);

  return [];
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
  generatedArtifactExcludes: [],
  writeRuntimeArtifacts: writeClaudeRuntimeArtifacts,
  listSessionIds: listClaudeSessionIds,
  buildInitCommand: buildClaudeInitCommand,
  parseInitStreamLine: parseClaudeStreamLine,
};
