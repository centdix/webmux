import { readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { isRecord } from "../lib/type-guards";
import { home, newestFirst, quoteShell, type StampedSession } from "./shared";
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
  listSessionIds: listCodexSessionIds,
};
