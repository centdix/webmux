import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeWorktreeMeta } from "../../backend/src/adapters/fs";
import { makeUnmanagedWorktreeId } from "../../backend/src/services/reconciliation-service";
import { resolveWorktreeIdByBranch, type WorktreeIdSource } from "./worktree-id";

describe("resolveWorktreeIdByBranch", () => {
  let tempDir = "";

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
    tempDir = "";
  });

  /** Fake git listing the main checkout plus `entries`; each worktree's git dir is `<path>.git`. */
  async function makeSource(entries: Array<{ name: string; branch: string | null; meta?: { id: string; branch: string } }>): Promise<WorktreeIdSource> {
    tempDir = await mkdtemp(join(tmpdir(), "webmux-worktree-id-"));
    const projectDir = join(tempDir, "repo");
    for (const entry of entries) {
      if (!entry.meta) continue;
      await writeWorktreeMeta(join(tempDir, `${entry.name}.git`), {
        schemaVersion: 1,
        worktreeId: entry.meta.id,
        branch: entry.meta.branch,
        createdAt: "2026-01-01T00:00:00.000Z",
        profile: "default",
        agent: "claude",
        runtime: "host",
        startupEnvValues: {},
      });
    }
    return {
      projectDir,
      git: {
        listLiveWorktrees: () => [
          { path: projectDir, branch: "main", bare: false },
          ...entries.map((entry) => ({ path: join(tempDir, entry.name), branch: entry.branch, bare: false })),
        ],
        resolveWorktreeGitDir: (path: string) => `${path}.git`,
      },
    };
  }

  it("finds a worktree by its git branch", async () => {
    const source = await makeSource([{ name: "a", branch: "feature/a", meta: { id: "wt-a", branch: "feature/old" } }]);

    expect(await resolveWorktreeIdByBranch(source, "feature/a")).toBe("wt-a");
  });

  it("finds a detached-HEAD worktree by the branch its meta recorded, like the server lists it", async () => {
    const source = await makeSource([{ name: "rebasing", branch: null, meta: { id: "wt-rebasing", branch: "feature/rebasing" } }]);

    expect(await resolveWorktreeIdByBranch(source, "feature/rebasing")).toBe("wt-rebasing");
  });

  it("finds an unmanaged detached-HEAD worktree by its directory name", async () => {
    const source = await makeSource([{ name: "loose", branch: null }]);

    expect(await resolveWorktreeIdByBranch(source, "loose")).toBe(makeUnmanagedWorktreeId(join(tempDir, "loose")));
  });

  it("never resolves the main checkout and reports an unknown branch", async () => {
    const source = await makeSource([{ name: "a", branch: "feature/a" }]);

    await expect(resolveWorktreeIdByBranch(source, "main")).rejects.toThrow("Worktree not found: main");
    await expect(resolveWorktreeIdByBranch(source, "feature/missing")).rejects.toThrow("Worktree not found: feature/missing");
  });
});
