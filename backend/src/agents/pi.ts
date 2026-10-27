import { readdir, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { isRecord } from "../lib/type-guards";
import { home, newestFirst, quoteShell, type StampedSession } from "./shared";
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

/** pi stores sessions under `<agent dir>/sessions/--<cwd with separators as dashes>--/`. */
function encodePiSessionDir(cwd: string): string {
  return `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
}

async function readPiSessionId(path: string): Promise<string | null> {
  try {
    const head = await Bun.file(path).slice(0, 4096).text();
    const parsed: unknown = JSON.parse(head.split("\n", 1)[0] ?? "");
    if (isRecord(parsed) && parsed.type === "session" && typeof parsed.id === "string") return parsed.id;
  } catch {
    // Fall back to the `<timestamp>_<id>.jsonl` file name.
  }
  return basename(path, ".jsonl").split("_").slice(1).join("_") || null;
}

async function listPiSessionIds(cwd: string): Promise<string[]> {
  const agentDir = Bun.env.PI_CODING_AGENT_DIR ?? join(home(), ".pi", "agent");
  const dir = join(agentDir, "sessions", encodePiSessionDir(cwd));
  const names = await readdir(dir).catch((): string[] => []);
  const stamped = await Promise.all(
    names
      .filter((name) => name.endsWith(".jsonl"))
      .map(async (name): Promise<StampedSession | null> => {
        const path = join(dir, name);
        const [info, sessionId] = await Promise.all([stat(path).catch(() => null), readPiSessionId(path)]);
        return info && sessionId ? { sessionId, mtimeMs: info.mtimeMs } : null;
      }),
  );
  return newestFirst(stamped.filter((entry): entry is StampedSession => entry !== null));
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
  listSessionIds: listPiSessionIds,
};
