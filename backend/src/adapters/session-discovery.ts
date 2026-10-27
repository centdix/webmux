import { getAgentAdapter } from "../agents";
import type { AgentKind } from "../domain/config";

/** Built-in agents whose session history we can discover. */
export type DiscoverableAgentKind = AgentKind;

export interface SessionDiscoveryGateway {
  /** Session ids for `cwd`, newest first. Claude reads `~/.claude/projects/<encoded>/`,
   *  Codex scans `~/.codex/sessions/**` and matches `session_meta.cwd`, opencode reads
   *  the ids its generated webmux plugin recorded for that worktree, and pi reads the headers
   *  of `~/.pi/agent/sessions/<encoded>/*.jsonl`. */
  listSessionIds(agent: DiscoverableAgentKind, cwd: string): Promise<string[]>;
}

export class FileSessionDiscovery implements SessionDiscoveryGateway {
  async listSessionIds(agent: DiscoverableAgentKind, cwd: string): Promise<string[]> {
    return await getAgentAdapter(agent).listSessionIds(cwd);
  }
}

/** Poll for a session id that appears in `cwd` but was not in `before`, returning the
 *  newest such id. Used to learn a freshly-forked session's id when it cannot be pinned
 *  (Codex). Returns null if nothing new shows up within the retry budget. */
export async function captureNewSessionId(
  discovery: SessionDiscoveryGateway,
  agent: DiscoverableAgentKind,
  cwd: string,
  before: string[],
  options: { attempts?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<string | null> {
  const beforeSet = new Set(before);
  const attempts = options.attempts ?? 20;
  const delayMs = options.delayMs ?? 150;
  const sleep = options.sleep ?? ((ms: number) => Bun.sleep(ms));

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const after = await discovery.listSessionIds(agent, cwd);
    const fresh = after.filter((id) => !beforeSet.has(id));
    if (fresh.length > 0) return fresh[0];
    await sleep(delayMs);
  }
  return null;
}
