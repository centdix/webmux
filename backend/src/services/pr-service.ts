import { readWorktreePrs, writeWorktreePrs } from "../adapters/fs";
import type { LinkedRepoConfig } from "../domain/config";
import type { CiCheck, PrComment, PrEntry } from "../domain/model";
import { mapWithConcurrency, startSerializedInterval } from "../lib/async";
import { log } from "../lib/log";

const PR_FETCH_LIMIT = 50;
const GH_TIMEOUT_MS = 15_000;

// ── Internal GH API shapes ────────────────────────────────────────────────────

type GhCheckStatus =
  | "QUEUED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "WAITING"
  | "REQUESTED"
  | "PENDING";

type GhCheckConclusion =
  | "SUCCESS"
  | "FAILURE"
  | "NEUTRAL"
  | "CANCELLED"
  | "SKIPPED"
  | "TIMED_OUT"
  | "ACTION_REQUIRED";

interface GhComment {
  author: { login: string };
  body: string;
  createdAt: string;
}

interface GhReviewComment {
  body: string;
  path: string;
  line: number | null;
  diff_hunk: string;
  user: { login: string };
  created_at: string;
  in_reply_to_id?: number;
}

// CheckRun entries from GitHub Actions
interface GhCheckRunEntry {
  __typename: "CheckRun";
  conclusion: GhCheckConclusion | null;
  status: GhCheckStatus;
  name: string;
  detailsUrl: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

// StatusContext entries from external CI (e.g. Vercel)
interface GhStatusContextEntry {
  __typename: "StatusContext";
  context: string;
  state: "SUCCESS" | "FAILURE" | "PENDING" | "ERROR" | "EXPECTED";
  targetUrl: string | null;
  createdAt?: string | null;
}

type GhCheckEntry = GhCheckRunEntry | GhStatusContextEntry;

interface GhPrEntry {
  number: number;
  headRefName: string;
  state: string;
  isDraft?: boolean;
  updatedAt: string;
  statusCheckRollup: GhCheckEntry[] | null;
  url: string;
  comments: GhComment[];
}

type FetchPrsResult =
  | { ok: true; data: Map<string, PrEntry> }
  | { ok: false; error: string; rateLimited: boolean };

/** The fields a single-PR refresh can re-read: everything else is list-only. */
type PrStatus = Pick<PrEntry, "state" | "isDraft">;

/** Outcome of one `gh` invocation. */
export type GhRunResult =
  | { timedOut: true }
  | { timedOut: false; exitCode: number; stdout: string; stderr: string };

/** Runs `gh` with the given args (without the leading "gh"). */
export type GhRunner = (args: string[], cwd: string | undefined) => Promise<GhRunResult>;

export interface PrSyncDeps {
  runGh: GhRunner;
  now: () => number;
}

// ── Per-project state for rate-limit mitigation ──────────────────────────────

/** Review comments last fetched for one PR, reused while `updatedAt` is unchanged
 *  and revalidated with `etag` (a 304 doesn't count against the rate limit). */
interface CachedReviewComments {
  /** Repo label the PR was listed under ("" for the project repo, else the alias). */
  repo: string;
  updatedAt: string;
  comments: PrComment[];
  etag: string | null;
}

/** GitHub quota a call draws from: `gh pr list` and `gh api graphql` use the
 *  GraphQL points budget, `gh api repos/...` the separate REST request budget. */
export type GhBucket = "graphql" | "rest";

/** Exponential backoff for one repo label and bucket after GitHub reported a rate limit. */
export interface RepoBackoff {
  failures: number;
  until: number;
}

/** Caches and backoff owned by one project. Must not be shared across projects:
 *  each sync evicts entries for PRs its repos no longer list as open. */
export interface PrSyncState {
  /** Keyed by `prKey` (real host/owner/repo + PR number). */
  reviewComments: Map<string, CachedReviewComments>;
  /** Keyed by `backoffKey` (bucket + repo label). */
  backoff: Map<string, RepoBackoff>;
}

/** Backoff key for a repo label ("" for the project repo, else the alias) and bucket. */
export function backoffKey(repoLabel: string, bucket: GhBucket): string {
  return `${bucket}:${repoLabel}`;
}

export function createPrSyncState(): PrSyncState {
  return { reviewComments: new Map(), backoff: new Map() };
}

const BACKOFF_BASE_MS = 10_000;
const BACKOFF_MAX_MS = 5 * 60_000;

// ── Pure helper functions (exported for unit testing) ─────────────────────────

/** Group key for an entry: check-run name, or external status context. */
function checkEntryKey(c: GhCheckEntry): string {
  return c.__typename === "StatusContext" ? `status:${c.context}` : `check:${c.name}`;
}

/** Parse an ISO timestamp to epoch ms, 0 when absent/invalid. */
function toEpoch(ts: string | null | undefined): number {
  const t = ts ? new Date(ts).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Recency of an entry (epoch ms) for latest-wins dedupe. For a check run, use
 * the later of startedAt/completedAt: GitHub reports completedAt as a zero
 * sentinel ("0001-01-01T00:00:00Z") while still running, so a live run would
 * otherwise sort as ancient and lose to an older completed run.
 */
function checkEntryTime(c: GhCheckEntry): number {
  if (c.__typename === "StatusContext") return toEpoch(c.createdAt);
  return Math.max(toEpoch(c.startedAt), toEpoch(c.completedAt));
}

/** A CANCELLED check-run is a superseded/aborted run, not a failing verdict. */
function isCancelled(c: GhCheckEntry): boolean {
  return c.__typename === "CheckRun" && c.conclusion === "CANCELLED";
}

/**
 * Collapse the rollup to the most recent entry per check name / status context.
 * Re-triggering a workflow (e.g. `/review` re-running codex CI) leaves the prior
 * run in the rollup under the same name; keeping only the latest lets the fresh
 * result win instead of a stale run masking it. Latest wins by completion time,
 * falling back to array order (GitHub returns oldest-first) on ties.
 */
export function dedupeLatestChecks(checks: GhCheckEntry[]): GhCheckEntry[] {
  const latest = new Map<string, GhCheckEntry>();
  for (const c of checks) {
    const key = checkEntryKey(c);
    const prev = latest.get(key);
    if (!prev || checkEntryTime(c) >= checkEntryTime(prev)) latest.set(key, c);
  }
  return [...latest.values()];
}

/** Summarize CI check status from a statusCheckRollup array. */
export function summarizeChecks(
  checks: GhCheckEntry[] | null,
): PrEntry["ciStatus"] {
  if (!checks || checks.length === 0) return "none";
  // Drop CANCELLED runs: a codex CI review cancelled when `/review` re-triggers
  // it (concurrency cancel-in-progress) reports CANCELLED, which must not mask
  // the latest run — otherwise the PR stays "failed" forever. Also dedupe so a
  // same-name re-run's fresh result wins over the superseded one.
  const relevant = dedupeLatestChecks(checks).filter((c) => !isCancelled(c));
  if (relevant.length === 0) return "none";
  const allDone = relevant.every((c) =>
    c.__typename === "StatusContext"
      ? c.state !== "PENDING" && c.state !== "EXPECTED"
      : c.status === "COMPLETED",
  );
  if (!allDone) return "pending";
  const allPass = relevant.every((c) => {
    if (c.__typename === "StatusContext") return c.state === "SUCCESS";
    return c.conclusion === "SUCCESS" || c.conclusion === "NEUTRAL" || c.conclusion === "SKIPPED";
  });
  return allPass ? "success" : "failed";
}

/** Parse a GitHub Actions run ID from a details URL. Returns null when not found. */
export function parseRunId(detailsUrl: string | null): number | null {
  if (!detailsUrl) return null;
  const match = detailsUrl.match(/\/actions\/runs\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/** Derive a typed check status from GH conclusion/status fields. */
export function deriveCheckStatus(check: GhCheckEntry): CiCheck["status"] {
  if (check.__typename === "StatusContext") {
    const s = check.state;
    if (s === "SUCCESS") return "success";
    if (s === "PENDING" || s === "EXPECTED") return "pending";
    return "failed";
  }
  if (check.status !== "COMPLETED") return "pending";
  const c = check.conclusion;
  if (c === "SUCCESS" || c === "NEUTRAL") return "success";
  // CANCELLED = superseded (e.g. codex CI re-triggered by `/review`); not a failure.
  if (c === "SKIPPED" || c === "CANCELLED") return "skipped";
  return "failed";
}

/** Map raw GH check entries to typed CiCheck array. */
export function mapChecks(checks: GhCheckEntry[] | null): CiCheck[] {
  if (!checks || checks.length === 0) return [];
  return dedupeLatestChecks(checks).map((c) => {
    const name = c.__typename === "StatusContext" ? c.context : c.name;
    const url = c.__typename === "StatusContext" ? c.targetUrl : c.detailsUrl;
    return {
      name,
      status: deriveCheckStatus(c),
      url,
      runId: parseRunId(url),
    };
  });
}

/** Parse raw `gh api` review comments JSON into typed array. Keeps most recent 50. */
export function parseReviewComments(json: string): PrComment[] {
  const raw = JSON.parse(json) as GhReviewComment[];
  const sorted = raw.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return sorted.slice(0, PR_FETCH_LIMIT).map((c) => ({
    type: "inline" as const,
    author: c.user?.login ?? "unknown",
    body: c.body ?? "",
    createdAt: c.created_at ?? "",
    path: c.path ?? "",
    line: c.line ?? null,
    diffHunk: c.diff_hunk ?? "",
    isReply: c.in_reply_to_id !== undefined,
  }));
}

/** Parse raw `gh pr list --json` output into a branch → PrEntry map. Throws on invalid JSON. */
export function parsePrResponse(
  json: string,
  repoLabel?: string,
): Map<string, PrEntry> {
  const prs = new Map<string, PrEntry>();
  const entries = JSON.parse(json) as GhPrEntry[];
  for (const entry of entries) {
    // If multiple PRs share the same branch in one repo, the first (most recent) wins.
    if (prs.has(entry.headRefName)) continue;
    prs.set(entry.headRefName, {
      repo: repoLabel ?? "",
      number: entry.number,
      state: entry.state.toLowerCase() as PrEntry["state"],
      isDraft: entry.isDraft === true,
      url: entry.url,
      updatedAt: entry.updatedAt ?? "",
      ciStatus: summarizeChecks(entry.statusCheckRollup),
      ciChecks: mapChecks(entry.statusCheckRollup),
      comments: (entry.comments ?? []).map((c) => ({
        type: "comment" as const,
        author: c.author?.login ?? "unknown",
        body: c.body ?? "",
        createdAt: c.createdAt ?? "",
      })),
    });
  }
  return prs;
}

interface PrRef {
  host: string;
  owner: string;
  name: string;
  number: number;
}

/** Parse `https://<host>/<owner>/<repo>/pull/<n>`. Returns null for anything else. */
export function parsePrUrl(url: string): PrRef | null {
  const match = url.match(/^https?:\/\/([^/]+)\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return { host: match[1], owner: match[2], name: match[3], number: parseInt(match[4], 10) };
}

/** Cache key for a PR: the real repo it lives in plus its number, so equal PR
 *  numbers in different repos never collide. */
export function prKey(entry: Pick<PrEntry, "repo" | "number" | "url">): string {
  const ref = parsePrUrl(entry.url);
  return ref ? `${ref.host}/${ref.owner}/${ref.name}#${ref.number}` : `${entry.repo}#${entry.number}`;
}

/** Whether `gh` output reports a GitHub primary or secondary rate limit. */
export function isRateLimitError(output: string): boolean {
  return /rate limit|HTTP\/?[\d.]* 429/i.test(output);
}

/** Next backoff after another rate-limited call: 10s, 20s, 40s, … capped at 5 min. */
export function nextBackoff(prev: RepoBackoff | undefined, now: number): RepoBackoff {
  const failures = (prev?.failures ?? 0) + 1;
  const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (failures - 1));
  return { failures, until: now + delay };
}

/** GraphQL query reading state/isDraft of several PRs of one repo in one call. */
export function buildPrStatusBatchQuery(numbers: number[]): string {
  const fields = numbers.map((n) => `pr${n}: pullRequest(number: ${n}) { state isDraft }`);
  return `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { ${fields.join(" ")} } }`;
}

/** Parse the response of `buildPrStatusBatchQuery`: PR number → status. PRs the
 *  response doesn't resolve are omitted. Returns null when unusable. */
export function parsePrStatusBatch(json: string): Map<number, PrStatus> | null {
  try {
    const data = JSON.parse(json) as { data?: { repository?: Record<string, unknown> | null } };
    const repository = data.data?.repository;
    if (!repository || typeof repository !== "object") return null;
    const statuses = new Map<number, PrStatus>();
    for (const [alias, value] of Object.entries(repository)) {
      const match = alias.match(/^pr(\d+)$/);
      if (!match || !value || typeof value !== "object") continue;
      const pr = value as { state?: unknown; isDraft?: unknown };
      if (typeof pr.state !== "string") continue;
      statuses.set(parseInt(match[1], 10), {
        state: pr.state.toLowerCase() as PrEntry["state"],
        isDraft: pr.isDraft === true,
      });
    }
    return statuses;
  } catch {
    return null;
  }
}

// ── I/O functions ─────────────────────────────────────────────────────────────

/** Spawn `gh` with a hard timeout so a hung process never stalls the caller. */
async function spawnGh(args: string[], cwd: string | undefined): Promise<GhRunResult> {
  const proc = Bun.spawn(["gh", ...args], {
    stdout: "pipe",
    stderr: "pipe",
    ...(cwd ? { cwd } : {}),
  });

  const timeout = Bun.sleep(GH_TIMEOUT_MS).then(() => {
    proc.kill();
    return "timeout" as const;
  });

  const completed = Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const raceResult = await Promise.race([completed, timeout]);
  if (raceResult === "timeout") return { timedOut: true };
  const [exitCode, stdout, stderr] = raceResult;
  return { timedOut: false, exitCode, stdout, stderr };
}

type GhOutcome = "ok" | "rate_limited" | "failed";

function ghOutcome(result: { ok: true } | { ok: false; rateLimited: boolean }): GhOutcome {
  if (result.ok) return "ok";
  return result.rateLimited ? "rate_limited" : "failed";
}

const DEFAULT_PR_SYNC_DEPS: PrSyncDeps = { runGh: spawnGh, now: Date.now };

function isBackingOff(state: PrSyncState, repoLabel: string, bucket: GhBucket, now: number): boolean {
  const backoff = state.backoff.get(backoffKey(repoLabel, bucket));
  return backoff !== undefined && now < backoff.until;
}

/** Reset a repo's backoff for one bucket after a successful call, or extend it
 *  after a rate limit. Other failures leave it unchanged. */
function recordGhOutcome(
  state: PrSyncState,
  repoLabel: string,
  bucket: GhBucket,
  outcome: GhOutcome,
  now: number,
): void {
  const key = backoffKey(repoLabel, bucket);
  if (outcome === "ok") {
    state.backoff.delete(key);
  } else if (outcome === "rate_limited") {
    const backoff = nextBackoff(state.backoff.get(key), now);
    state.backoff.set(key, backoff);
    log.warn(
      `[pr] GitHub ${bucket} rate limit for repo "${repoLabel || "current"}"; backing off ${Math.round((backoff.until - now) / 1000)}s`,
    );
  }
}

/**
 * Fetch all open PRs from a repo via `gh` CLI.
 * Returns a Result: on success, a map of branch name → PrEntry; on failure, an error string.
 * Applies a hard timeout so a hung `gh` process never stalls the caller.
 */
export async function fetchAllPrs(
  repoSlug?: string,
  repoLabel?: string,
  cwd?: string,
  runGh: GhRunner = spawnGh,
): Promise<FetchPrsResult> {
  const label = repoSlug ?? "current";
  const args = [
    "pr",
    "list",
    "--state",
    "open",
    "--json",
    "number,headRefName,state,isDraft,updatedAt,statusCheckRollup,url,comments",
    "--limit",
    String(PR_FETCH_LIMIT),
  ];
  if (repoSlug) args.push("--repo", repoSlug);

  const result = await runGh(args, cwd);
  if (result.timedOut) {
    return { ok: false, error: `gh pr list timed out for ${label}`, rateLimited: false };
  }

  if (result.exitCode !== 0) {
    return {
      ok: false,
      error: `gh pr list failed for ${label} (exit ${result.exitCode}): ${result.stderr.trim()}`,
      rateLimited: isRateLimitError(result.stderr),
    };
  }

  try {
    return { ok: true, data: parsePrResponse(result.stdout, repoLabel) };
  } catch (err) {
    return { ok: false, error: `failed to parse gh output for ${label}: ${err}`, rateLimited: false };
  }
}

interface RepoTarget {
  /** "" for the project repo, else the linked-repo alias. */
  label: string;
  /** undefined for the project repo (resolved by `gh` from the cwd). */
  slug: string | undefined;
}

function repoTargets(linkedRepos: LinkedRepoConfig[]): RepoTarget[] {
  return [
    { label: "", slug: undefined },
    ...linkedRepos.map(({ repo, alias }) => ({ label: alias, slug: repo })),
  ];
}

function sortByCreatedAt(comments: PrComment[]): PrComment[] {
  return comments.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

type ReviewCommentsResult =
  | { kind: "fetched"; comments: PrComment[]; etag: string | null }
  | { kind: "not_modified" }
  | { kind: "failed"; rateLimited: boolean };

/** Fetch inline review comments for a single PR via `gh api`, revalidating with
 *  `etag` when given. Conditional requests (304) don't count against GitHub's rate limit. */
async function fetchReviewComments(
  prNumber: number,
  repoSlug: string | undefined,
  etag: string | null,
  cwd: string | undefined,
  runGh: GhRunner,
): Promise<ReviewCommentsResult> {
  const repoFlag = repoSlug
    ? repoSlug
    : "{owner}/{repo}";
  const apiPath = `repos/${repoFlag}/pulls/${prNumber}/comments?per_page=100`;
  const args = [
    "api",
    apiPath,
    "--include",
  ];

  if (etag) {
    args.push("--header", `If-None-Match: ${etag}`);
  }

  const result = await runGh(args, cwd);
  if (result.timedOut) return { kind: "failed", rateLimited: false };

  const raw = result.stdout;
  const failedCall = (): ReviewCommentsResult => ({
    kind: "failed",
    rateLimited: isRateLimitError(`${result.stderr}\n${raw}`),
  });

  // gh api --include prefixes the body with HTTP headers separated by a blank line
  let blankLineIdx = raw.indexOf("\r\n\r\n");
  let separatorLen = 4;
  if (blankLineIdx === -1) {
    blankLineIdx = raw.indexOf("\n\n");
    separatorLen = 2;
  }
  if (blankLineIdx === -1) {
    // No headers found — may be an error or empty response
    if (result.exitCode !== 0) return failedCall();
    try {
      return { kind: "fetched", comments: parseReviewComments(raw), etag: null };
    } catch {
      return { kind: "failed", rateLimited: false };
    }
  }

  const headerBlock = raw.slice(0, blankLineIdx);
  const body = raw.slice(blankLineIdx + separatorLen);

  // Check for 304 Not Modified
  if (headerBlock.includes("304 Not Modified")) {
    log.debug(`[pr] etag cache hit for PR #${prNumber}`);
    return { kind: "not_modified" };
  }

  if (result.exitCode !== 0) return failedCall();

  // Parse ETag from response headers
  const etagMatch = headerBlock.match(/^etag:\s*(.+)$/mi);

  try {
    return {
      kind: "fetched",
      comments: parseReviewComments(body),
      etag: etagMatch ? etagMatch[1].trim() : null,
    };
  } catch {
    return { kind: "failed", rateLimited: false };
  }
}

type PrStatusesResult =
  | { ok: true; data: Map<number, PrStatus> }
  | { ok: false; rateLimited: boolean };

/** Read the current state of several PRs of one repo with a single GraphQL call. */
async function fetchPrStatuses(
  ref: Pick<PrRef, "host" | "owner" | "name">,
  numbers: number[],
  runGh: GhRunner,
): Promise<PrStatusesResult> {
  const result = await runGh([
    "api", "graphql",
    "--hostname", ref.host,
    "-f", `query=${buildPrStatusBatchQuery(numbers)}`,
    "-f", `owner=${ref.owner}`,
    "-f", `name=${ref.name}`,
  ], undefined);
  if (result.timedOut) return { ok: false, rateLimited: false };

  // gh exits non-zero when one alias fails to resolve but still prints the rest.
  const statuses = parsePrStatusBatch(result.stdout);
  if (statuses) return { ok: true, data: statuses };
  return {
    ok: false,
    rateLimited: result.exitCode !== 0 && isRateLimitError(`${result.stderr}\n${result.stdout}`),
  };
}

/** Update stored PR state for worktrees whose PRs are no longer in the open PR list.
 *  Re-reads every entry still marked "open", with one call per repo (not per PR).
 *  Refreshes `isDraft` too: an entry can be absent from the open-PR list while still
 *  open (a failed repo fetch, or PR_FETCH_LIMIT truncation), and a draft marked ready
 *  in that window would otherwise keep rendering as a draft. */
async function refreshStalePrData(
  gitDirs: string[],
  state: PrSyncState,
  deps: PrSyncDeps,
): Promise<void> {
  const stored = await Promise.all(
    gitDirs.map(async (gitDir) => ({ gitDir, entries: await readWorktreePrs(gitDir) })),
  );
  const stale = stored.filter(({ entries }) => entries.some((e) => e.state === "open"));
  if (stale.length === 0) return;

  const now = deps.now();
  const byRepo = new Map<string, { ref: PrRef; repoLabels: Set<string>; numbers: Set<number> }>();
  for (const { entries } of stale) {
    for (const entry of entries) {
      if (entry.state !== "open" || isBackingOff(state, entry.repo, "graphql", now)) continue;
      const ref = parsePrUrl(entry.url);
      if (!ref) continue;
      const repoKey = `${ref.host}/${ref.owner}/${ref.name}`;
      const group = byRepo.get(repoKey) ?? { ref, repoLabels: new Set<string>(), numbers: new Set<number>() };
      group.repoLabels.add(entry.repo);
      group.numbers.add(ref.number);
      byRepo.set(repoKey, group);
    }
  }

  const statuses = new Map<string, PrStatus>();
  await Promise.all(
    [...byRepo].map(async ([repoKey, group]) => {
      const result = await fetchPrStatuses(group.ref, [...group.numbers], deps.runGh);
      for (const label of group.repoLabels) {
        recordGhOutcome(state, label, "graphql", ghOutcome(result), now);
      }
      if (!result.ok) return;
      for (const [number, status] of result.data) statuses.set(`${repoKey}#${number}`, status);
    }),
  );

  await Promise.all(
    stale.map(({ gitDir, entries }) =>
      writeWorktreePrs(
        gitDir,
        entries.map((entry) => {
          if (entry.state !== "open") return entry;
          const status = statuses.get(prKey(entry));
          return status ? { ...entry, ...status } : entry;
        }),
      ),
    ),
  );
}

/** Record a PR the agent just opened (known only by its URL) on the worktree, so the
 *  badge shows before the next sync. Needs no `gh` call; the sync fills in the rest.
 *  Returns false when the URL is not a PR URL or the PR is already recorded. */
export async function linkOpenedPr(
  gitDir: string,
  url: string,
  linkedRepos: LinkedRepoConfig[],
): Promise<boolean> {
  const ref = parsePrUrl(url);
  if (!ref) return false;
  const existing = await readWorktreePrs(gitDir);
  const key = `${ref.host}/${ref.owner}/${ref.name}#${ref.number}`;
  if (existing.some((entry) => prKey(entry) === key)) return false;
  const slug = `${ref.owner}/${ref.name}`.toLowerCase();
  const entry: PrEntry = {
    repo: linkedRepos.find((lr) => lr.repo.toLowerCase() === slug)?.alias ?? "",
    number: ref.number,
    state: "open",
    isDraft: false,
    url,
    updatedAt: "",
    ciStatus: "none",
    ciChecks: [],
    comments: [],
  };
  await writeWorktreePrs(gitDir, [entry, ...existing]);
  return true;
}

/** Sync PR status into per-worktree webmux storage for all worktrees that have open PRs.
 *  `state` holds this project's caches and backoff and must not be shared with
 *  another project. */
export async function syncPrStatus(
  getWorktreeGitDirs: () => Promise<Map<string, string>>,
  linkedRepos: LinkedRepoConfig[],
  projectDir: string | undefined,
  state: PrSyncState,
  deps: PrSyncDeps = DEFAULT_PR_SYNC_DEPS,
): Promise<void> {
  log.debug(`[pr] starting sync (${1 + linkedRepos.length} repo(s))`);
  const now = deps.now();
  // Fetch current repo + all linked repos in parallel, skipping repos in backoff.
  const allRepoResults = await Promise.all(
    repoTargets(linkedRepos).map(async ({ label, slug }) => {
      if (isBackingOff(state, label, "graphql", now)) {
        log.info(`[pr] skipping PR list for ${slug ?? "current"}: rate-limit backoff`);
        return { label, result: null };
      }
      const result = await fetchAllPrs(slug, label, projectDir, deps.runGh);
      recordGhOutcome(state, label, "graphql", ghOutcome(result), now);
      return { label, result };
    }),
  );

  // Log fetch errors; aggregate successes into branch → PrEntry[].
  const branchPrs = new Map<string, PrEntry[]>();
  const listedRepos = new Set<string>();
  for (const { label, result } of allRepoResults) {
    if (!result) continue;
    if (!result.ok) {
      log.error(`[pr] ${result.error}`);
      continue;
    }
    listedRepos.add(label);
    for (const [branch, entry] of result.data) {
      const existing = branchPrs.get(branch) ?? [];
      existing.push(entry);
      branchPrs.set(branch, existing);
    }
  }

  const worktreeGitDirs = await getWorktreeGitDirs();
  const activeBranches = new Set(worktreeGitDirs.keys());

  // Fetch inline review comments only for PRs matching active worktrees.
  // PRs that haven't been updated reuse cached comments (saves API calls).
  // Repos whose REST budget is in backoff keep showing cached comments.
  const reviewTuples: {
    entry: PrEntry;
    key: string;
    cached: CachedReviewComments | undefined;
    repoSlug: string | undefined;
  }[] = [];
  const restBackoffRepos = new Set<string>();
  for (const [branch, entries] of branchPrs) {
    if (!activeBranches.has(branch)) continue;
    for (const entry of entries) {
      if (entry.state !== "open") continue;
      const key = prKey(entry);
      const cached = state.reviewComments.get(key);
      if (cached?.updatedAt === entry.updatedAt) {
        log.debug(`[pr] skipping comments for PR #${entry.number} (unchanged)`);
        entry.comments = sortByCreatedAt([...entry.comments, ...cached.comments]);
      } else if (isBackingOff(state, entry.repo, "rest", now)) {
        restBackoffRepos.add(entry.repo);
        entry.comments = sortByCreatedAt([...entry.comments, ...(cached?.comments ?? [])]);
      } else {
        const repoSlug = entry.repo
          ? linkedRepos.find((lr) => lr.alias === entry.repo)?.repo
          : undefined;
        reviewTuples.push({ entry, key, cached, repoSlug });
      }
    }
  }
  for (const repo of restBackoffRepos) {
    log.info(`[pr] skipping review comments for repo "${repo || "current"}": rate-limit backoff`);
  }
  if (reviewTuples.length > 0) {
    log.debug(`[pr] fetching review comments for ${reviewTuples.length} PR(s)`);
    // Once a repo's comments call is rate limited, issue no more for it this round.
    const rateLimitedRepos = new Set<string>();
    const succeededRepos = new Set<string>();
    const reviewResults = await mapWithConcurrency(
      reviewTuples,
      5,
      async (t): Promise<ReviewCommentsResult | { kind: "skipped" }> => {
        if (rateLimitedRepos.has(t.entry.repo)) return { kind: "skipped" };
        const result = await fetchReviewComments(
          t.entry.number, t.repoSlug, t.cached?.etag ?? null, projectDir, deps.runGh,
        );
        if (result.kind === "failed" && result.rateLimited) rateLimitedRepos.add(t.entry.repo);
        if (result.kind !== "failed") succeededRepos.add(t.entry.repo);
        return result;
      },
    );
    for (let i = 0; i < reviewTuples.length; i++) {
      const { entry, key, cached } = reviewTuples[i];
      const result = reviewResults[i];
      const comments = result.kind === "fetched" ? result.comments : cached?.comments ?? [];
      // A rate-limited or skipped PR leaves the cache untouched, so it is retried
      // once the backoff ends.
      const retryLater = result.kind === "skipped" || (result.kind === "failed" && result.rateLimited);
      if (!retryLater) {
        state.reviewComments.set(key, {
          repo: entry.repo,
          updatedAt: entry.updatedAt,
          comments,
          etag: result.kind === "fetched" ? result.etag : cached?.etag ?? null,
        });
      }
      entry.comments = sortByCreatedAt([...entry.comments, ...comments]);
    }
    for (const repo of rateLimitedRepos) recordGhOutcome(state, repo, "rest", "rate_limited", deps.now());
    for (const repo of succeededRepos) {
      if (!rateLimitedRepos.has(repo)) recordGhOutcome(state, repo, "rest", "ok", deps.now());
    }
  }
  const seen = new Set<string>();

  for (const [branch, entries] of branchPrs) {
    const gitDir = worktreeGitDirs.get(branch);
    if (!gitDir || seen.has(gitDir)) continue;
    seen.add(gitDir);

    await writeWorktreePrs(gitDir, entries);
  }

  if (seen.size > 0) {
    log.debug(
      `[pr] synced ${seen.size} worktree(s) with PR data from ${listedRepos.size} repo(s)`,
    );
  }

  // For worktrees not matched by the open-PR sync, refresh any stale "open"
  // entries so merged/closed PRs are reflected in stored worktree PR state.
  const unseenDirs = [...new Set(worktreeGitDirs.values())].filter((gitDir) => !seen.has(gitDir));
  await refreshStalePrData(unseenDirs, state, deps);

  // Evict cached comments for PRs no longer open — only in repos whose list call
  // succeeded this sync, so a failed or skipped call never wipes the cache.
  const openKeys = new Set<string>();
  for (const entries of branchPrs.values()) {
    for (const entry of entries) openKeys.add(prKey(entry));
  }
  for (const [key, cached] of state.reviewComments) {
    if (listedRepos.has(cached.repo) && !openKeys.has(key)) state.reviewComments.delete(key);
  }
}

/** Start periodic PR status sync. Returns a cleanup function that stops the monitor.
 *  When `isActive` is provided, a tick is skipped whenever it returns false; the
 *  server passes `dashboardActivity.prSyncGate(prefix)`, which paces each
 *  project's sync by dashboard focus. */
export function startPrMonitor(
  getWorktreeGitDirs: () => Promise<Map<string, string>>,
  linkedRepos: LinkedRepoConfig[],
  projectDir: string | undefined,
  state: PrSyncState,
  intervalMs: number = 10_000,
  isActive?: () => boolean,
): () => void {
  const run = async (): Promise<void> => {
    if (isActive && !isActive()) {
      log.debug("[pr] skipping PR sync: no active clients");
      return;
    }
    await syncPrStatus(getWorktreeGitDirs, linkedRepos, projectDir, state).catch(
      (err: unknown) => {
        log.error(`[pr] sync error: ${err}`);
      },
    );
  };

  return startSerializedInterval(run, intervalMs);
}

/** Fetch the PR state for every branch across the current repo and all linked
 *  repos, one `gh pr list --state all` call per repo. Unlike the display sync
 *  (open-only), this sees merged/closed PRs, so the auto-remove sweep can detect a
 *  merge even when no earlier open-state sync ever recorded the PR.
 *
 *  Returns null if any repo query failed or is in rate-limit backoff: a failed query
 *  is indistinguishable from "this branch has no PR here", and since auto-remove reads
 *  this live (no persisted fallback), proceeding on partial data could drop an open
 *  cross-repo PR and wrongly remove a merged-in-main worktree. Callers must treat
 *  null as "skip this sweep". */
export async function fetchBranchPrStates(
  linkedRepos: LinkedRepoConfig[],
  projectDir: string | undefined,
  state: PrSyncState,
  deps: PrSyncDeps = DEFAULT_PR_SYNC_DEPS,
): Promise<Map<string, PrEntry["state"][]> | null> {
  const now = deps.now();
  const targets = repoTargets(linkedRepos);
  if (targets.some(({ label }) => isBackingOff(state, label, "graphql", now))) {
    log.info("[auto-remove] skipping PR state fetch: rate-limit backoff");
    return null;
  }
  const perRepo = await Promise.all(
    targets.map(async ({ label, slug }) => {
      const result = await fetchRepoBranchStates(slug, projectDir, deps.runGh);
      recordGhOutcome(state, label, "graphql", ghOutcome(result), now);
      return result;
    }),
  );

  const states = new Map<string, PrEntry["state"][]>();
  for (const result of perRepo) {
    if (!result.ok) return null;
    for (const { branch, state: prState } of result.data) {
      const existing = states.get(branch) ?? [];
      existing.push(prState);
      states.set(branch, existing);
    }
  }
  return states;
}

type RepoBranchStatesResult =
  | { ok: true; data: Array<{ branch: string; state: PrEntry["state"] }> }
  | { ok: false; rateLimited: boolean };

/** Returns a failure (not []) so the caller can distinguish a failed query from a
 *  repo that genuinely has no matching PRs. */
async function fetchRepoBranchStates(
  repoSlug: string | undefined,
  cwd: string | undefined,
  runGh: GhRunner,
): Promise<RepoBranchStatesResult> {
  const args = [
    "pr",
    "list",
    "--state",
    "all",
    "--json",
    "headRefName,state",
    // Shares the display-sync limit. On a repo with heavy merged/closed history an
    // older PR for a still-checked-out branch may fall outside the window and never
    // be swept -- best-effort, but fails safe (a missed cleanup, never a wrong one).
    "--limit",
    String(PR_FETCH_LIMIT),
  ];
  if (repoSlug) args.push("--repo", repoSlug);

  const result = await runGh(args, cwd);
  if (result.timedOut) return { ok: false, rateLimited: false };
  if (result.exitCode !== 0) return { ok: false, rateLimited: isRateLimitError(result.stderr) };

  try {
    const raw = JSON.parse(result.stdout) as Array<{
      headRefName: string;
      state: string;
    }>;
    return {
      ok: true,
      data: raw.map((r) => ({
        branch: r.headRefName,
        state: r.state.toLowerCase() as PrEntry["state"],
      })),
    };
  } catch {
    return { ok: false, rateLimited: false };
  }
}

/** Periodically sweep merged worktrees. Runs independently of dashboard activity:
 *  PRs merge while nobody is watching the dashboard, and cleanup must happen anyway. */
export function startAutoRemoveMonitor(
  run: () => Promise<void>,
  intervalMs: number = 60_000,
): () => void {
  return startSerializedInterval(
    () =>
      run().catch((err: unknown) => {
        log.error(`[auto-remove] sweep error: ${err}`);
      }),
    intervalMs,
  );
}
