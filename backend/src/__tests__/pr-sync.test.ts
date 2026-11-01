import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeWorktreePrs } from "../adapters/fs";
import type { PrEntry } from "../domain/model";
import type { GhRunResult, GhRunner, PrSyncDeps, PrSyncState } from "../services/pr-service";
import { backoffKey, createPrSyncState, fetchBranchPrStates, syncPrStatus } from "../services/pr-service";

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
  /** Slugs whose calls fail with a GitHub rate-limit error. */
  readonly rateLimited = new Set<string>();
  /** Slugs whose REST review-comments calls fail with a 403 rate limit (GraphQL still works). */
  readonly restRateLimited = new Set<string>();
  /** PRs (`slug#number`) GraphQL cannot resolve; the batch exits 1 with partial data. */
  readonly unresolvable = new Set<string>();
  /** Slugs whose calls fail with a non-rate-limit error. */
  readonly failing = new Set<string>();
  /** Final state of PRs that are no longer open, keyed `slug#number`. */
  readonly closedStates = new Map<string, "MERGED" | "CLOSED">();
  private readonly repoByCwd = new Map<string, string>();
  private readonly prsBySlug = new Map<string, FakePr[]>();

  addRepo(slug: string, prs: FakePr[], cwd?: string): void {
    this.prsBySlug.set(slug, prs);
    if (cwd) this.repoByCwd.set(cwd, slug);
  }

  setAllUpdatedAt(slug: string, updatedAt: string): void {
    for (const pr of this.prsBySlug.get(slug) ?? []) pr.updatedAt = updatedAt;
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

  graphqlCalls(): GhCall[] {
    return this.calls.filter((c) => c.args[0] === "api" && c.args[1] === "graphql");
  }

  readonly run: GhRunner = async (args, cwd) => {
    this.calls.push({ args, cwd });
    const slug = this.slugOf(args, cwd);
    if (this.rateLimited.has(slug)) {
      return { timedOut: false, exitCode: 1, stdout: "", stderr: "GraphQL: API rate limit exceeded for user ID 1." };
    }
    if (this.failing.has(slug)) {
      return { timedOut: false, exitCode: 1, stdout: "", stderr: "HTTP 502: Bad Gateway" };
    }
    if (args[0] === "pr" && args[1] === "list") return this.prList(args, slug);
    if (args[0] === "api" && args[1].includes("/comments")) {
      if (this.restRateLimited.has(slug)) {
        return {
          timedOut: false,
          exitCode: 1,
          stdout: 'HTTP/2.0 403 Forbidden\r\nX-Ratelimit-Remaining: 0\r\n\r\n{"message":"API rate limit exceeded for user ID 1."}',
          stderr: "gh: API rate limit exceeded for user ID 1. (HTTP 403)",
        };
      }
      return this.comments(args, slug);
    }
    if (args[0] === "api" && args[1] === "graphql") return this.prStatuses(args, slug);
    return { timedOut: false, exitCode: 1, stdout: "", stderr: `unexpected gh call: ${args.join(" ")}` };
  };

  private slugOf(args: string[], cwd: string | undefined): string {
    const repoFlag = args.indexOf("--repo");
    if (repoFlag >= 0) return args[repoFlag + 1];
    const commentsPath = args[1]?.match(/^repos\/(.+)\/pulls\/\d+\/comments/);
    if (commentsPath) return this.resolveSlug(commentsPath[1], cwd);
    const field = (name: string): string =>
      args.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
    if (args[1] === "graphql") return `${field("owner")}/${field("name")}`;
    return this.resolveSlug(undefined, cwd);
  }

  private resolveSlug(explicit: string | undefined, cwd: string | undefined): string {
    if (explicit && explicit !== "{owner}/{repo}") return explicit;
    return (cwd && this.repoByCwd.get(cwd)) ?? "";
  }

  private prList(args: string[], slug: string): GhRunResult {
    if (args.includes("all")) {
      const all = (this.prsBySlug.get(slug) ?? []).map((p) => ({ headRefName: p.branch, state: "OPEN" }));
      return { timedOut: false, exitCode: 0, stdout: JSON.stringify(all), stderr: "" };
    }
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

  private prStatuses(args: string[], slug: string): GhRunResult {
    const query = args.find((a) => a.startsWith("query=")) ?? "";
    const repository: Record<string, { state: string; isDraft: boolean } | null> = {};
    let unresolved = false;
    for (const [, n] of query.matchAll(/pr(\d+):/g)) {
      if (this.unresolvable.has(`${slug}#${n}`)) {
        repository[`pr${n}`] = null;
        unresolved = true;
        continue;
      }
      repository[`pr${n}`] = { state: this.closedStates.get(`${slug}#${n}`) ?? "OPEN", isDraft: false };
    }
    return {
      timedOut: false,
      exitCode: unresolved ? 1 : 0,
      stdout: JSON.stringify({ data: { repository } }),
      stderr: unresolved ? "gh: Could not resolve to a PullRequest" : "",
    };
  }

  private comments(args: string[], slug: string): GhRunResult {
    const number = Number(args[1].match(/\/pulls\/(\d+)\//)?.[1]);
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
  state: PrSyncState;
  gitDirs: Map<string, string>;
  getWorktreeGitDirs: () => Promise<Map<string, string>>;
}

async function makeProject(
  gh: FakeGh,
  name: string,
  prs: FakePr[],
  extraBranches: string[] = [],
): Promise<TestProject> {
  const dir = `/projects/${name}`;
  const slug = `org/${name}`;
  gh.addRepo(slug, prs, dir);
  const gitDirs = new Map<string, string>();
  for (const branch of [...prs.map((p) => p.branch), ...extraBranches]) {
    gitDirs.set(branch, await makeGitDir());
  }
  return { dir, slug, state: createPrSyncState(), gitDirs, getWorktreeGitDirs: async () => gitDirs };
}

function storedOpenPr(slug: string, repo: string, number: number): PrEntry {
  return {
    repo,
    number,
    state: "open",
    isDraft: true,
    url: `https://github.com/${slug}/pull/${number}`,
    updatedAt: "t0",
    ciStatus: "none",
    ciChecks: [],
    comments: [],
  };
}

function sync(project: TestProject, deps: PrSyncDeps, linked: TestProject[] = []): Promise<void> {
  const linkedRepos = linked.map((l) => ({ repo: l.slug, alias: l.slug.split("/")[1] }));
  return syncPrStatus(project.getWorktreeGitDirs, linkedRepos, project.dir, project.state, deps);
}

function makeDeps(gh: FakeGh, clock: { now: number } = { now: 0 }): PrSyncDeps {
  return { runGh: gh.run, now: () => clock.now };
}

describe("syncPrStatus — review comment caches across projects", () => {
  it("does not refetch review comments when two projects sync alternately", async () => {
    const gh = new FakeGh();
    const deps = makeDeps(gh);
    const a = await makeProject(gh, "a", [{ number: 12, branch: "feat-a", updatedAt: "t1" }]);
    const b = await makeProject(gh, "b", [{ number: 7, branch: "feat-b", updatedAt: "t1" }]);

    for (let tick = 0; tick < 3; tick++) {
      await sync(a, deps);
      await sync(b, deps);
    }

    // One initial fetch per project; nothing changed afterwards, so no refetch.
    expect(gh.commentCalls()).toHaveLength(2);
  });

  it("revalidates with the right ETag for equal PR numbers in different repos", async () => {
    const gh = new FakeGh();
    const deps = makeDeps(gh);
    const a = await makeProject(gh, "a", [{ number: 12, branch: "feat", updatedAt: "t1" }]);
    const b = await makeProject(gh, "b", [{ number: 12, branch: "feat", updatedAt: "t1" }]);

    await sync(a, deps);
    await sync(b, deps);
    gh.setUpdatedAt(a.slug, 12, "t2");
    gh.setUpdatedAt(b.slug, 12, "t2");
    gh.calls.length = 0;
    await sync(a, deps);
    await sync(b, deps);

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

describe("syncPrStatus — failed list calls", () => {
  it("keeps cached comments when a list call fails", async () => {
    const gh = new FakeGh();
    const deps = makeDeps(gh);
    const a = await makeProject(gh, "a", [{ number: 12, branch: "feat", updatedAt: "t1" }]);

    await sync(a, deps);
    gh.failing.add(a.slug);
    await sync(a, deps);
    gh.failing.delete(a.slug);
    await sync(a, deps);

    expect(gh.commentCalls()).toHaveLength(1);
  });
});

describe("syncPrStatus — stale open PR refresh", () => {
  it("refreshes stale open PRs with one call per repo, not one per PR", async () => {
    const gh = new FakeGh();
    const deps = makeDeps(gh);
    const lib = await makeProject(gh, "lib", []);
    const branches = ["w1", "w2", "w3", "w4"];
    const a = await makeProject(gh, "a", [], branches);
    for (const [i, branch] of branches.entries()) {
      const gitDir = a.gitDirs.get(branch) ?? "";
      await writeWorktreePrs(gitDir, [storedOpenPr(a.slug, "", i + 1), storedOpenPr(lib.slug, "lib", i + 100)]);
      gh.closedStates.set(`${a.slug}#${i + 1}`, "MERGED");
    }

    await sync(a, deps, [lib]);

    expect(gh.calls.filter((c) => c.args[0] === "pr" && c.args[1] === "view")).toHaveLength(0);
    expect(gh.graphqlCalls()).toHaveLength(2);
    const stored = await Bun.file(join(a.gitDirs.get("w1") ?? "", "webmux", "prs.json")).json();
    expect(stored).toMatchObject([
      { number: 1, state: "merged", isDraft: false },
      { number: 100, state: "open", isDraft: false },
    ]);
  });
});

describe("syncPrStatus — rate-limit backoff", () => {
  it("does not fan out per worktree when the list call is rate limited", async () => {
    const gh = new FakeGh();
    const deps = makeDeps(gh);
    const branches = ["w1", "w2", "w3"];
    const a = await makeProject(gh, "a", [], branches);
    for (const [i, branch] of branches.entries()) {
      await writeWorktreePrs(a.gitDirs.get(branch) ?? "", [storedOpenPr(a.slug, "", i + 1)]);
    }
    gh.rateLimited.add(a.slug);

    await sync(a, deps);

    expect(gh.calls).toHaveLength(1);
  });

  it("skips a rate-limited repo while backing off, then resumes and resets", async () => {
    const gh = new FakeGh();
    const clock = { now: 0 };
    const deps = makeDeps(gh, clock);
    const a = await makeProject(gh, "a", [{ number: 12, branch: "feat", updatedAt: "t1" }]);
    const listCalls = (): number => gh.calls.filter((c) => c.args[0] === "pr").length;

    gh.rateLimited.add(a.slug);
    await sync(a, deps); // rate limited: back off 10s
    expect(listCalls()).toBe(1);

    clock.now = 5_000;
    await sync(a, deps);
    expect(listCalls()).toBe(1);

    clock.now = 10_000;
    await sync(a, deps); // still rate limited: back off 20s
    expect(listCalls()).toBe(2);

    clock.now = 25_000;
    await sync(a, deps);
    expect(listCalls()).toBe(2);

    gh.rateLimited.delete(a.slug);
    clock.now = 30_000;
    await sync(a, deps); // succeeds: backoff reset
    expect(listCalls()).toBe(3);
    expect(gh.commentCalls()).toHaveLength(1);

    clock.now = 30_001;
    await sync(a, deps);
    expect(listCalls()).toBe(4);
  });

  it("skips the auto-remove PR state fetch while the repo is backing off", async () => {
    const gh = new FakeGh();
    const clock = { now: 0 };
    const deps = makeDeps(gh, clock);
    const a = await makeProject(gh, "a", [{ number: 12, branch: "feat", updatedAt: "t1" }]);

    gh.rateLimited.add(a.slug);
    expect(await fetchBranchPrStates([], a.dir, a.state, deps)).toBeNull();
    expect(await fetchBranchPrStates([], a.dir, a.state, deps)).toBeNull();
    expect(gh.calls).toHaveLength(1);

    gh.rateLimited.delete(a.slug);
    clock.now = 10_000;
    expect(await fetchBranchPrStates([], a.dir, a.state, deps)).toEqual(new Map([["feat", ["open"]]]));
  });
});

describe("syncPrStatus — separate GraphQL and REST backoff", () => {
  it("keeps growing the REST backoff while only review-comment calls are rate limited", async () => {
    const gh = new FakeGh();
    const clock = { now: 0 };
    const deps = makeDeps(gh, clock);
    const prs = Array.from({ length: 7 }, (_, i) => ({ number: i + 1, branch: `w${i + 1}`, updatedAt: "t1" }));
    const a = await makeProject(gh, "a", prs);
    const restBackoff = (): number | undefined => a.state.backoff.get(backoffKey("", "rest"))?.failures;
    const storedUpdatedAt = async (): Promise<string> => {
      const stored = await Bun.file(join(a.gitDirs.get("w1") ?? "", "webmux", "prs.json")).json();
      return stored[0].updatedAt;
    };

    await sync(a, deps);
    expect(gh.commentCalls()).toHaveLength(7);

    gh.restRateLimited.add(a.slug);
    gh.setAllUpdatedAt(a.slug, "t2");
    gh.calls.length = 0;
    await sync(a, deps);
    // The first rate-limited response stops the round: only the calls already in
    // flight (concurrency 5) are made.
    expect(gh.commentCalls()).toHaveLength(5);
    expect(restBackoff()).toBe(1);

    for (const [now, expectedFailures, expectedCalls] of [
      [5_000, 1, 0],
      [10_000, 2, 5],
      [25_000, 2, 0],
      [30_000, 3, 5],
      [60_000, 3, 0],
    ] as const) {
      clock.now = now;
      gh.setAllUpdatedAt(a.slug, `t${now}`);
      gh.calls.length = 0;
      await sync(a, deps);
      expect(gh.commentCalls()).toHaveLength(expectedCalls);
      expect(restBackoff()).toBe(expectedFailures);
      // The GraphQL list still runs and PR state keeps updating.
      expect(gh.calls.filter((c) => c.args[0] === "pr")).toHaveLength(1);
      expect(await storedUpdatedAt()).toBe(`t${now}`);
    }
    expect(a.state.backoff.has(backoffKey("", "graphql"))).toBe(false);

    gh.restRateLimited.delete(a.slug);
    clock.now = 70_000;
    gh.calls.length = 0;
    await sync(a, deps);
    expect(gh.commentCalls()).toHaveLength(7);
    expect(restBackoff()).toBeUndefined();
  });

  it("backs off a rate-limited linked repo while the project repo keeps syncing", async () => {
    const gh = new FakeGh();
    const clock = { now: 0 };
    const deps = makeDeps(gh, clock);
    const lib = await makeProject(gh, "lib", [{ number: 3, branch: "lib-feat", updatedAt: "t1" }]);
    const a = await makeProject(gh, "a", [{ number: 12, branch: "feat", updatedAt: "t1" }]);
    gh.rateLimited.add(lib.slug);

    await sync(a, deps, [lib]);
    clock.now = 5_000;
    gh.calls.length = 0;
    await sync(a, deps, [lib]);

    const listCalls = gh.calls.filter((c) => c.args[0] === "pr");
    expect(listCalls).toHaveLength(1);
    expect(listCalls[0].args).not.toContain("--repo");
    expect(a.state.backoff.has(backoffKey("lib", "graphql"))).toBe(true);
    expect(a.state.backoff.has(backoffKey("", "graphql"))).toBe(false);
    const stored = await Bun.file(join(a.gitDirs.get("feat") ?? "", "webmux", "prs.json")).json();
    expect(stored).toMatchObject([{ number: 12, state: "open" }]);
  });
});

describe("syncPrStatus — partial GraphQL stale refresh", () => {
  it("applies partial data when the batch exits 1 because one PR does not resolve", async () => {
    const gh = new FakeGh();
    const deps = makeDeps(gh);
    const a = await makeProject(gh, "a", [], ["w1"]);
    await writeWorktreePrs(a.gitDirs.get("w1") ?? "", [storedOpenPr(a.slug, "", 1), storedOpenPr(a.slug, "", 2)]);
    gh.closedStates.set(`${a.slug}#1`, "MERGED");
    gh.unresolvable.add(`${a.slug}#2`);

    await sync(a, deps);

    expect(gh.graphqlCalls()).toHaveLength(1);
    const stored = await Bun.file(join(a.gitDirs.get("w1") ?? "", "webmux", "prs.json")).json();
    expect(stored).toMatchObject([
      { number: 1, state: "merged", isDraft: false },
      { number: 2, state: "open", isDraft: true },
    ]);
    expect(a.state.backoff.size).toBe(0);
  });
});
