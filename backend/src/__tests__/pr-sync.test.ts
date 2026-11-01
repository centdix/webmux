import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GhRunResult, GhRunner, PrSyncDeps } from "../services/pr-service";
import { syncPrStatus } from "../services/pr-service";

interface FakePr {
  number: number;
  branch: string;
  updatedAt: string;
}

interface GhCall {
  args: string[];
  cwd: string | undefined;
}

/** A stub `gh` serving one GitHub repo per project dir (resolved from cwd, like
 *  `{owner}/{repo}` placeholders) plus repos addressed by an explicit slug. */
class FakeGh {
  readonly calls: GhCall[] = [];
  private readonly repoByCwd = new Map<string, string>();
  private readonly prsBySlug = new Map<string, FakePr[]>();

  addRepo(slug: string, prs: FakePr[], cwd?: string): void {
    this.prsBySlug.set(slug, prs);
    if (cwd) this.repoByCwd.set(cwd, slug);
  }

  setUpdatedAt(slug: string, number: number, updatedAt: string): void {
    const pr = this.prsBySlug.get(slug)?.find((p) => p.number === number);
    if (pr) pr.updatedAt = updatedAt;
  }

  etagFor(slug: string, number: number): string {
    return `"${slug}#${number}"`;
  }

  commentCalls(): GhCall[] {
    return this.calls.filter((c) => c.args[0] === "api" && c.args[1].includes("/comments"));
  }

  readonly run: GhRunner = async (args, cwd) => {
    this.calls.push({ args, cwd });
    if (args[0] === "pr" && args[1] === "list") return this.prList(args, cwd);
    if (args[0] === "api" && args[1].includes("/comments")) return this.comments(args, cwd);
    if (args[0] === "pr" && args[1] === "view") {
      return { timedOut: false, exitCode: 0, stdout: JSON.stringify({ state: "OPEN", isDraft: false }), stderr: "" };
    }
    return { timedOut: false, exitCode: 1, stdout: "", stderr: `unexpected gh call: ${args.join(" ")}` };
  };

  private resolveSlug(explicit: string | undefined, cwd: string | undefined): string {
    if (explicit && explicit !== "{owner}/{repo}") return explicit;
    return (cwd && this.repoByCwd.get(cwd)) ?? "";
  }

  private prList(args: string[], cwd: string | undefined): GhRunResult {
    const repoFlag = args.indexOf("--repo");
    const slug = this.resolveSlug(repoFlag >= 0 ? args[repoFlag + 1] : undefined, cwd);
    const prs = (this.prsBySlug.get(slug) ?? []).map((p) => ({
      number: p.number,
      headRefName: p.branch,
      state: "OPEN",
      isDraft: false,
      updatedAt: p.updatedAt,
      statusCheckRollup: [],
      url: `https://github.com/${slug}/pull/${p.number}`,
      comments: [],
    }));
    return { timedOut: false, exitCode: 0, stdout: JSON.stringify(prs), stderr: "" };
  }

  private comments(args: string[], cwd: string | undefined): GhRunResult {
    const match = args[1].match(/^repos\/(.+)\/pulls\/(\d+)\/comments/);
    const slug = this.resolveSlug(match?.[1], cwd);
    const number = Number(match?.[2]);
    const etag = this.etagFor(slug, number);
    const headerIdx = args.indexOf("--header");
    const ifNoneMatch = headerIdx >= 0 ? args[headerIdx + 1].replace(/^If-None-Match:\s*/, "") : null;
    if (ifNoneMatch === etag) {
      return { timedOut: false, exitCode: 1, stdout: "HTTP/2.0 304 Not Modified\r\n\r\n", stderr: "" };
    }
    return {
      timedOut: false,
      exitCode: 0,
      stdout: `HTTP/2.0 200 OK\r\nEtag: ${etag}\r\n\r\n[]`,
      stderr: "",
    };
  }
}

const tempDirs: string[] = [];

async function makeGitDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "webmux-pr-sync-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

interface TestProject {
  dir: string;
  slug: string;
  getWorktreeGitDirs: () => Promise<Map<string, string>>;
}

async function makeProject(gh: FakeGh, name: string, prs: FakePr[]): Promise<TestProject> {
  const dir = `/projects/${name}`;
  const slug = `org/${name}`;
  gh.addRepo(slug, prs, dir);
  const gitDirs = new Map<string, string>();
  for (const pr of prs) gitDirs.set(pr.branch, await makeGitDir());
  return { dir, slug, getWorktreeGitDirs: async () => gitDirs };
}

describe("syncPrStatus — review comment caches across projects", () => {
  it("does not refetch review comments when two projects sync alternately", async () => {
    const gh = new FakeGh();
    const deps: PrSyncDeps = { runGh: gh.run };
    const a = await makeProject(gh, "a", [{ number: 12, branch: "feat-a", updatedAt: "t1" }]);
    const b = await makeProject(gh, "b", [{ number: 7, branch: "feat-b", updatedAt: "t1" }]);

    for (let tick = 0; tick < 3; tick++) {
      await syncPrStatus(a.getWorktreeGitDirs, [], a.dir, deps);
      await syncPrStatus(b.getWorktreeGitDirs, [], b.dir, deps);
    }

    // One initial fetch per project; nothing changed afterwards, so no refetch.
    expect(gh.commentCalls()).toHaveLength(2);
  });

  it("revalidates with the right ETag for equal PR numbers in different repos", async () => {
    const gh = new FakeGh();
    const deps: PrSyncDeps = { runGh: gh.run };
    const a = await makeProject(gh, "a", [{ number: 12, branch: "feat", updatedAt: "t1" }]);
    const b = await makeProject(gh, "b", [{ number: 12, branch: "feat", updatedAt: "t1" }]);

    await syncPrStatus(a.getWorktreeGitDirs, [], a.dir, deps);
    await syncPrStatus(b.getWorktreeGitDirs, [], b.dir, deps);
    gh.setUpdatedAt(a.slug, 12, "t2");
    gh.setUpdatedAt(b.slug, 12, "t2");
    gh.calls.length = 0;
    await syncPrStatus(a.getWorktreeGitDirs, [], a.dir, deps);
    await syncPrStatus(b.getWorktreeGitDirs, [], b.dir, deps);

    const sentEtags = gh.commentCalls().map((c) => {
      const idx = c.args.indexOf("--header");
      return { cwd: c.cwd, header: idx >= 0 ? c.args[idx + 1] : null };
    });
    expect(sentEtags).toEqual([
      { cwd: a.dir, header: `If-None-Match: ${gh.etagFor(a.slug, 12)}` },
      { cwd: b.dir, header: `If-None-Match: ${gh.etagFor(b.slug, 12)}` },
    ]);
  });
});
