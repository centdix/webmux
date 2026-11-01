import { startSerializedInterval, type SerializedIntervalDependencies } from "../lib/async";
import { log } from "../lib/log";
import { branchMatchesIssue, fetchAssignedIssues, type LinearIssue } from "./linear-service";
import type { CreateLifecycleWorktreeInput } from "./lifecycle-service";
import type { GitGateway } from "../adapters/git";

export const LINEAR_AUTO_CREATE_POLL_INTERVAL_MS = 60_000;
/** Slack between the poll interval and the accepted issue age, so a result
 *  fetched by another project's tick in the current interval is reused while
 *  this project's previous tick result is not. */
const ISSUE_MAX_AGE_MARGIN_MS = 5_000;

function issueMaxAgeForInterval(pollIntervalMs: number): number {
  return Math.max(0, pollIntervalMs - ISSUE_MAX_AGE_MARGIN_MS);
}

export interface LinearAutoCreateLifecycleService {
  createWorktree(input: CreateLifecycleWorktreeInput): Promise<{
    branch: string;
    worktreeId: string;
  }>;
}

export interface LinearAutoCreateDependencies {
  lifecycleService: LinearAutoCreateLifecycleService;
  git: Pick<GitGateway, "listWorktrees">;
  projectRoot: string;
  /** Process-wide, shared by every project: issue IDs some project has
   *  claimed (worktree created / oneshot started, or an attempt in progress).
   *  An issue matching several projects is acted on once, by the first. */
  claimedIssueIds: Set<string>;
  /** This project's failed attempts. Stops this project retrying a permanent
   *  failure every poll without blocking other projects from the issue. */
  failedIssueIds: Set<string>;
  fetchIssues?: typeof fetchAssignedIssues;
  /** Optional handler for the `webmux_oneshot` label variant. Must return the actual
   *  working branch — the oneshot seed may resolve to `attachmentPayload.branch ??
   *  pr.branch ?? issue.branchName`, which is not always `issue.branchName`. When
   *  omitted, oneshot triggering is skipped. */
  runOneshotForIssue?: (issueId: string) => Promise<{ branch: string }>;
  /** Restrict triggering to issues whose team.key is in this list (uppercase).
   *  Undefined or empty → no team filter (all teams). */
  watchTeamKeys?: string[];
  /** Optional callback invoked after a successful oneshot pickup so external automation
   *  can be notified. `branch` is the actual working branch (can differ from
   *  `issue.branchName` — see `runOneshotForIssue`). Failures are logged and
   *  swallowed — they must not block the pickup itself.
   *  Only fires for the `webmux_oneshot` path: regular `webmux` pickups are
   *  user-driven and don't need a Linear-side bookend. */
  onOneshotPickedUp?: (input: { issue: LinearIssue; branch: string }) => Promise<void>;
}

export interface LinearAutoCreateMonitorOptions {
  intervalDeps?: SerializedIntervalDependencies<unknown>;
  /** Overrides {@link LINEAR_AUTO_CREATE_POLL_INTERVAL_MS}. */
  pollIntervalMs?: number;
}

const AUTO_CREATE_LABEL = "webmux";
const AUTO_ONESHOT_LABEL = "webmux_oneshot";

function hasLabel(issue: LinearIssue, name: string): boolean {
  return issue.labels.some((l) => l.name.toLowerCase() === name);
}

function matchesTeamFilter(issue: LinearIssue, watchTeamKeys: string[] | undefined): boolean {
  if (!watchTeamKeys || watchTeamKeys.length === 0) return true;
  // watchTeamKeys is expected already-uppercase: parseTeamKeyList normalizes
  // and dedupes before this code is reached.
  return watchTeamKeys.includes(issue.team.key.toUpperCase());
}

/** Shared filter: Todo state, the label rule supplied by the caller, not
 *  skipped (claimed or failed), no existing worktree on the branch, and (when configured) the
 *  issue's team is in the watch list. */
function filterTriggerableIssues(
  issues: LinearIssue[],
  existingBranches: string[],
  matchesLabelRule: (issue: LinearIssue) => boolean,
  watchTeamKeys: string[] | undefined,
  skippedIssueIds: ReadonlySet<string>,
): LinearIssue[] {
  return issues.filter((issue) => {
    if (issue.state.name !== "Todo") return false;
    if (!matchesLabelRule(issue)) return false;
    if (!matchesTeamFilter(issue, watchTeamKeys)) return false;
    if (skippedIssueIds.has(issue.id)) return false;
    return !existingBranches.some((branch) => branchMatchesIssue(branch, issue.branchName));
  });
}

/** Filter issues to only those in Todo state with the "webmux" label that don't already
 *  have a worktree, excluding any tagged with the oneshot variant. */
export function filterAutoCreateIssues(
  issues: LinearIssue[],
  existingBranches: string[],
  watchTeamKeys?: string[],
  skippedIssueIds: ReadonlySet<string> = new Set(),
): LinearIssue[] {
  return filterTriggerableIssues(
    issues,
    existingBranches,
    (issue) => hasLabel(issue, AUTO_CREATE_LABEL) && !hasLabel(issue, AUTO_ONESHOT_LABEL),
    watchTeamKeys,
    skippedIssueIds,
  );
}

/** Filter issues to only those in Todo state with the "webmux_oneshot" label that don't already
 *  have a worktree. The "webmux_oneshot" label wins over "webmux" — issues tagged with both
 *  run via oneshot mode. */
export function filterAutoOneshotIssues(
  issues: LinearIssue[],
  existingBranches: string[],
  watchTeamKeys?: string[],
  skippedIssueIds: ReadonlySet<string> = new Set(),
): LinearIssue[] {
  return filterTriggerableIssues(
    issues,
    existingBranches,
    (issue) => hasLabel(issue, AUTO_ONESHOT_LABEL),
    watchTeamKeys,
    skippedIssueIds,
  );
}

/** One poll for one project. The assigned-issues query is the same for every
 *  project, so projects share one cached result: it is reused while younger
 *  than `maxIssueAgeMs`, and concurrent ticks share one in-flight request. */
export async function runLinearAutoCreateOnce(
  deps: LinearAutoCreateDependencies,
  options: { maxIssueAgeMs?: number } = {},
): Promise<void> {
  const fetchIssues = deps.fetchIssues ?? fetchAssignedIssues;
  const maxAgeMs = options.maxIssueAgeMs ?? issueMaxAgeForInterval(LINEAR_AUTO_CREATE_POLL_INTERVAL_MS);
  const result = await fetchIssues({ maxAgeMs });
  if (!result.ok) {
    log.error(`[linear-auto-create] failed to fetch issues: ${result.error}`);
    return;
  }

  // Evict dedup entries for issues that are no longer eligible (label removed,
  // state moved out of Todo, or issue disappeared). Without this the dedup set
  // would grow forever and removing+re-adding a label couldn't retrigger,
  // which the README promises.
  const eligibleIssueIds = new Set(
    result.data
      .filter(
        (issue) =>
          issue.state.name === "Todo" &&
          (hasLabel(issue, AUTO_CREATE_LABEL) || hasLabel(issue, AUTO_ONESHOT_LABEL)),
      )
      .map((issue) => issue.id),
  );
  for (const ids of [deps.claimedIssueIds, deps.failedIssueIds]) {
    for (const id of ids) {
      if (!eligibleIssueIds.has(id)) ids.delete(id);
    }
  }
  const skippedIssueIds = new Set([...deps.claimedIssueIds, ...deps.failedIssueIds]);

  const projectRoot = deps.projectRoot;
  // Raw listWorktrees on purpose: a stale registration still holds its branch
  // in git's view, so we must treat it as taken to avoid re-creating a worktree
  // for an already-registered branch. listLiveWorktrees would skip it.
  const existingBranches = deps.git
    .listWorktrees(projectRoot)
    .filter((entry) => !entry.bare && entry.branch !== null)
    .map((entry) => entry.branch as string);

  const oneshotIssues = deps.runOneshotForIssue
    ? filterAutoOneshotIssues(result.data, existingBranches, deps.watchTeamKeys, skippedIssueIds)
    : [];
  const createIssues = filterAutoCreateIssues(result.data, existingBranches, deps.watchTeamKeys, skippedIssueIds);

  if (oneshotIssues.length === 0 && createIssues.length === 0) {
    log.debug(`[linear-auto-create] no new labeled issues (${result.data.length} assigned, ${existingBranches.length} worktrees)`);
    return;
  }

  if (oneshotIssues.length > 0) {
    log.info(`[linear-auto-create] found ${oneshotIssues.length} new issue(s) with "${AUTO_ONESHOT_LABEL}" label`);
    for (const issue of oneshotIssues) {
      if (!claimIssue(deps, issue)) continue;
      try {
        log.info(`[linear-auto-create] launching oneshot for ${issue.identifier}: ${issue.title}`);
        const { branch } = await deps.runOneshotForIssue!(issue.identifier);
        log.info(`[linear-auto-create] launched oneshot for ${issue.identifier} on ${branch}`);
        await notifyOneshotPickup(deps, issue, branch);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error(`[linear-auto-create] failed to launch oneshot for ${issue.identifier}: ${msg}`);
        // Record the failure for this project so a permanent failure (e.g.
        // "Branch already exists" for an out-of-band local branch) doesn't
        // retry every 60s forever, and release the claim so other projects
        // can still pick the issue up. The label-eviction pass still lets the
        // user retrigger by removing and re-adding the label.
        releaseFailedIssue(deps, issue);
      }
    }
  }

  if (createIssues.length > 0) {
    log.info(`[linear-auto-create] found ${createIssues.length} new issue(s) with "${AUTO_CREATE_LABEL}" label`);
    for (const issue of createIssues) {
      if (!claimIssue(deps, issue)) continue;
      try {
        log.info(`[linear-auto-create] creating worktree for ${issue.identifier}: ${issue.title}`);
        await deps.lifecycleService.createWorktree({
          mode: "new",
          branch: issue.branchName,
          prompt: `${issue.title}\n\n${issue.description ?? ""}`.trim(),
        });
        log.info(`[linear-auto-create] created worktree for ${issue.identifier}`);
        // No Linear pickup comment for the regular `webmux` path — the user
        // triggered this themselves by labeling, so the comment would just be
        // noise. The oneshot bookend (above) is for the autonomous case where
        // there's no human in the loop.
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error(`[linear-auto-create] failed to create worktree for ${issue.identifier}: ${msg}`);
        // See the oneshot branch above — dedup on permanent failures.
        releaseFailedIssue(deps, issue);
      }
    }
  }
}

/** Claim before acting, not after: other projects' ticks run concurrently, so a
 *  claim taken only on success would let two projects act on the same issue. */
function claimIssue(deps: LinearAutoCreateDependencies, issue: LinearIssue): boolean {
  if (deps.claimedIssueIds.has(issue.id)) return false;
  deps.claimedIssueIds.add(issue.id);
  return true;
}

function releaseFailedIssue(deps: LinearAutoCreateDependencies, issue: LinearIssue): void {
  deps.claimedIssueIds.delete(issue.id);
  deps.failedIssueIds.add(issue.id);
}

async function notifyOneshotPickup(
  deps: LinearAutoCreateDependencies,
  issue: LinearIssue,
  branch: string,
): Promise<void> {
  if (!deps.onOneshotPickedUp) return;
  try {
    await deps.onOneshotPickedUp({ issue, branch });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`[linear-auto-create] pickup notification failed for ${issue.identifier}: ${msg}`);
  }
}

/** Start periodic polling for new Linear Todo issues and auto-create worktrees.
 *  Returns a cleanup function that stops the monitor. */
export function startLinearAutoCreateMonitor(
  deps: LinearAutoCreateDependencies,
  options: LinearAutoCreateMonitorOptions = {},
): () => void {
  const pollIntervalMs = options.pollIntervalMs ?? LINEAR_AUTO_CREATE_POLL_INTERVAL_MS;
  log.info(`[linear-auto-create] monitor started (interval: ${pollIntervalMs}ms)`);
  const maxIssueAgeMs = issueMaxAgeForInterval(pollIntervalMs);
  return startSerializedInterval<unknown>(
    () => runLinearAutoCreateOnce(deps, { maxIssueAgeMs }),
    pollIntervalMs,
    options.intervalDeps,
  );
}
