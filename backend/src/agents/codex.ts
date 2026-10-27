import { tmpdir } from "node:os";
import { mkdir, readdir, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { isRecord } from "../lib/type-guards";
import {
  closeAssistant,
  emitStatus,
  emitWarning,
  extractCommandText,
  extractStructuredMessage,
  extractTextBlocks,
  home,
  type HookConfigFile,
  newestFirst,
  quoteShell,
  readString,
  type StampedSession,
  streamSnapshot,
  truncateText,
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

async function readCodexSessionCwdId(path: string): Promise<{ id: string; cwd: string } | null> {
  try {
    // The `session_meta` record carrying cwd + id is the first line; 16KB covers it.
    const head = await Bun.file(path).slice(0, 16384).text();
    const firstLine = head.split("\n", 1)[0];
    if (!firstLine) return null;
    const parsed: unknown = JSON.parse(firstLine);
    if (!isRecord(parsed) || parsed.type !== "session_meta" || !isRecord(parsed.payload)) return null;
    const { id, cwd } = parsed.payload;
    return typeof id === "string" && typeof cwd === "string" ? { id, cwd } : null;
  } catch {
    return null;
  }
}

async function listCodexSessionIds(cwd: string): Promise<string[]> {
  const root = join(home(), ".codex", "sessions");
  const relPaths = await readdir(root, { recursive: true }).catch((): string[] => []);
  const rollouts = relPaths.filter((rel) => {
    const name = basename(rel);
    return name.startsWith("rollout-") && name.endsWith(".jsonl");
  });
  const stamped = await Promise.all(
    rollouts.map(async (rel): Promise<StampedSession | null> => {
      const path = join(root, rel);
      const meta = await readCodexSessionCwdId(path);
      if (!meta || meta.cwd !== cwd) return null;
      const info = await stat(path).catch(() => null);
      return info ? { sessionId: meta.id, mtimeMs: info.mtimeMs } : null;
    }),
  );
  return newestFirst(stamped.filter((entry): entry is StampedSession => entry !== null));
}

export function codexHooksPath(worktreePath: string): string {
  return join(worktreePath, ".codex", "hooks.json");
}

function buildCodexHookSettings(input: { agentCtlPath: string }): HookConfigFile {
  const statusCommand = `${quoteShell(input.agentCtlPath)} status-changed --lifecycle running --best-effort`;
  return {
    hooks: {
      SessionStart: [
        {
          matcher: "startup|resume|clear",
          hooks: [
            {
              type: "command",
              command: `${quoteShell(input.agentCtlPath)} codex-session-start`,
              timeout: 30,
            },
          ],
        },
      ],
      UserPromptSubmit: [
        {
          hooks: [
            {
              type: "command",
              command: `${quoteShell(input.agentCtlPath)} codex-user-prompt-submit`,
              timeout: 30,
            },
          ],
        },
      ],
      PermissionRequest: [
        {
          hooks: [
            {
              type: "command",
              command: `${quoteShell(input.agentCtlPath)} codex-permission-request`,
              timeout: 30,
            },
          ],
        },
      ],
      PreToolUse: [
        {
          hooks: [
            {
              type: "command",
              command: statusCommand,
              timeout: 30,
            },
          ],
        },
      ],
      PostToolUse: [
        {
          matcher: "Bash",
          hooks: [
            {
              type: "command",
              command: `${quoteShell(input.agentCtlPath)} codex-post-tool-use`,
              timeout: 30,
            },
          ],
        },
      ],
      Stop: [
        {
          hooks: [
            {
              type: "command",
              command: `${quoteShell(input.agentCtlPath)} codex-stop`,
              timeout: 30,
            },
          ],
        },
      ],
    },
  };
}

function commandStartsWithAgentCtl(command: string, agentCtlPath: string): boolean {
  const trimmedCommand = command.trimStart();
  const quotedAgentCtlPath = quoteShell(agentCtlPath);
  return trimmedCommand === agentCtlPath
    || trimmedCommand.startsWith(`${agentCtlPath} `)
    || trimmedCommand === quotedAgentCtlPath
    || trimmedCommand.startsWith(`${quotedAgentCtlPath} `);
}

function isWebmuxHookGroup(group: unknown, agentCtlPath: string): boolean {
  if (!isRecord(group) || !Array.isArray(group.hooks)) return false;
  return group.hooks.some((hook) =>
    isRecord(hook)
    && typeof hook.command === "string"
    && commandStartsWithAgentCtl(hook.command, agentCtlPath)
  );
}

async function mergeCodexHooksFile(
  hooksPath: string,
  hookSettings: HookConfigFile["hooks"],
  agentCtlPath: string,
): Promise<void> {
  let existing: Record<string, unknown> = {};

  try {
    const file = Bun.file(hooksPath);
    if (await file.exists()) {
      const parsed = await file.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        existing = parsed as Record<string, unknown>;
      }
    }
  } catch {
    existing = {};
  }

  const existingHooks = isRecord(existing.hooks) ? existing.hooks : {};
  const mergedHooks: Record<string, unknown> = { ...existingHooks };
  for (const [eventName, groups] of Object.entries(hookSettings)) {
    const eventGroups = existingHooks[eventName];
    const preservedGroups = Array.isArray(eventGroups)
      ? eventGroups.filter((group) => !isWebmuxHookGroup(group, agentCtlPath))
      : [];
    mergedHooks[eventName] = [...preservedGroups, ...groups];
  }

  await Bun.write(hooksPath, JSON.stringify({ ...existing, hooks: mergedHooks }, null, 2) + "\n");
}

async function writeCodexRuntimeArtifacts(ctx: RuntimeArtifactsContext): Promise<void> {
  const hooksPath = codexHooksPath(ctx.worktreePath);
  await mkdir(dirname(hooksPath), { recursive: true });
  await mergeCodexHooksFile(hooksPath, buildCodexHookSettings(ctx).hooks, ctx.agentCtlPath);
}

const FAST_CODEX_MODEL = "gpt-5.1-codex";
const FAST_CODEX_REASONING = "low";

function buildCodexInitCommand(prompt: InitPromptSpec, outputPrefix: string): InitAgentCommandSpec {
  const summaryPath = join(tmpdir(), `${outputPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`);
  return {
    agent: "codex",
    cmd: "codex",
    args: [
      "exec",
      "--sandbox",
      "workspace-write",
      "--color",
      "never",
      "--json",
      "-m",
      FAST_CODEX_MODEL,
      "-o",
      summaryPath,
      "-c",
      `model_reasoning_effort="${FAST_CODEX_REASONING}"`,
      "-c",
      `developer_instructions=${prompt.systemPrompt}`,
      prompt.userPrompt,
    ],
    summaryPath,
  };
}

function parseCodexStatus(raw: Record<string, unknown>, type: string): string | null {
  const command = extractCommandText(raw.command)
    ?? (isRecord(raw.item) ? extractCommandText(raw.item.command) : null);
  if (command && (type.includes("command") || type.includes("exec") || type.includes("shell"))) {
    return `Running ${truncateText(command)}`;
  }

  const toolName = readString(raw.tool_name)
    ?? readString(raw.name)
    ?? (isRecord(raw.item) ? readString(raw.item.name) : null);
  if (toolName && (type.includes("tool") || type.includes("function"))) {
    return `Using ${toolName}...`;
  }

  const status = readString(raw.status);
  if (status && !["completed", "done", "finished"].includes(status)) {
    return truncateText(status);
  }

  if (type.includes("turn")) return "Thinking...";
  return null;
}

function parseCodexStreamLine(
  raw: Record<string, unknown>,
  state: InitAgentStreamState,
): InitAgentStreamEvent[] {
  const type = readString(raw.type) ?? readString(raw.event) ?? "unknown";

  if (type === "response.output_text.delta" && typeof raw.delta === "string") {
    return [{ kind: "assistant_delta", text: raw.delta }];
  }

  if (type === "response.output_text.done") {
    const text = readString(raw.text) ?? extractTextBlocks(raw.item).trim();
    return [...(text ? streamSnapshot(state, text) : []), ...closeAssistant(state)];
  }

  if (type.includes("error")) {
    const message = isRecord(raw.error) ? readString(raw.error.message) : readString(raw.message);
    return emitWarning(state, message ?? "Codex returned an error.");
  }

  const status = parseCodexStatus(raw, type);
  if (status) return emitStatus(state, status);

  if (type.includes("delta") && typeof raw.delta === "string") {
    return [{ kind: "assistant_delta", text: raw.delta }];
  }

  const snapshot = extractStructuredMessage(raw);
  if (snapshot && (type.includes("assistant") || type.includes("message") || type.includes("output") || type.includes("response"))) {
    const events = streamSnapshot(state, snapshot);
    if (type.includes("done") || type.includes("completed") || type.includes("finished")) {
      events.push(...closeAssistant(state));
    }
    return events;
  }

  if (type.includes("done") || type.includes("completed") || type.includes("finished")) {
    return closeAssistant(state);
  }

  return [];
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
  generatedArtifactExcludes: [".codex/hooks.json"],
  writeRuntimeArtifacts: writeCodexRuntimeArtifacts,
  listSessionIds: listCodexSessionIds,
  buildInitCommand: buildCodexInitCommand,
  parseInitStreamLine: parseCodexStreamLine,
};
