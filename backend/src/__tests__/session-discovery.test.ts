import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { opencodeSessionsPath } from "../adapters/agent-runtime";
import {
  captureNewSessionId,
  FileSessionDiscovery,
  type SessionDiscoveryGateway,
} from "../adapters/session-discovery";

/** Returns a fresh list of ids on each call, simulating a session file appearing late. */
function scriptedDiscovery(sequence: string[][]): SessionDiscoveryGateway {
  let call = 0;
  return {
    async listSessionIds(): Promise<string[]> {
      const result = sequence[Math.min(call, sequence.length - 1)] ?? [];
      call += 1;
      return result;
    },
  };
}

const noSleep = async (): Promise<void> => {};

describe("captureNewSessionId", () => {
  it("returns the id that appears after the spawn", async () => {
    const discovery = scriptedDiscovery([["new-1", "old-1"]]);
    const id = await captureNewSessionId(discovery, "claude", "/cwd", ["old-1"], { sleep: noSleep });
    expect(id).toBe("new-1");
  });

  it("polls until the new session file shows up", async () => {
    // First two polls see only the pre-existing session, third sees the fork.
    const discovery = scriptedDiscovery([["old-1"], ["old-1"], ["fork-2", "old-1"]]);
    const id = await captureNewSessionId(discovery, "codex", "/cwd", ["old-1"], { sleep: noSleep, attempts: 5 });
    expect(id).toBe("fork-2");
  });

  it("returns the newest of multiple new ids (listing is newest-first)", async () => {
    const discovery = scriptedDiscovery([["newest", "older-new", "old-1"]]);
    const id = await captureNewSessionId(discovery, "claude", "/cwd", ["old-1"], { sleep: noSleep });
    expect(id).toBe("newest");
  });

  it("returns null when nothing new appears within the retry budget", async () => {
    const discovery = scriptedDiscovery([["old-1"]]);
    const id = await captureNewSessionId(discovery, "claude", "/cwd", ["old-1"], { sleep: noSleep, attempts: 3 });
    expect(id).toBeNull();
  });
});

describe("FileSessionDiscovery opencode sessions", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function worktreeWithSessionLog(lines: string[]): Promise<string> {
    const worktreePath = await mkdtemp(join(tmpdir(), "webmux-opencode-sessions-"));
    tempDirs.push(worktreePath);
    await Bun.write(opencodeSessionsPath(worktreePath), lines.join("\n"));
    return worktreePath;
  }

  it("reads recorded opencode sessions newest first", async () => {
    const worktreePath = await worktreeWithSessionLog([
      JSON.stringify({ id: "ses_older", at: 1000 }),
      JSON.stringify({ id: "ses_newest", at: 3000 }),
      JSON.stringify({ id: "ses_middle", at: 2000 }),
      "",
    ]);

    expect(await new FileSessionDiscovery().listSessionIds("opencode", worktreePath))
      .toEqual(["ses_newest", "ses_middle", "ses_older"]);
  });

  it("skips malformed lines and reports nothing when no session was recorded", async () => {
    const worktreePath = await worktreeWithSessionLog([
      "not json",
      JSON.stringify({ id: "ses_ok", at: 10 }),
      JSON.stringify({ missing: "fields" }),
    ]);
    const emptyWorktree = await mkdtemp(join(tmpdir(), "webmux-opencode-empty-"));
    tempDirs.push(emptyWorktree);

    expect(await new FileSessionDiscovery().listSessionIds("opencode", worktreePath)).toEqual(["ses_ok"]);
    expect(await new FileSessionDiscovery().listSessionIds("opencode", emptyWorktree)).toEqual([]);
  });
});
