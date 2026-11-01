import type { CiCheck, ProjectWorktreeList } from "../lib/types";
import { worktreeKey } from "../lib/worktree-ref";
import { MOCK_PROJECTS, comments, pr, wt } from "./mock";
import type { LabPr, PrExtras } from "./pr-lab";

const CHECK_NAMES = ["build", "test (ubuntu)", "test (macos)", "lint", "typecheck", "e2e"];

/** `statuses` in check order, e.g. "ssfp" = 2 passed, 1 failed, 1 pending. */
function checks(statuses: string): CiCheck[] {
  const map: Record<string, CiCheck["status"]> = { s: "success", f: "failed", p: "pending", k: "skipped" };
  return [...statuses].map((code, i) => ({ name: CHECK_NAMES[i], status: map[code], url: null, runId: null }));
}

function labPr(number: number, overrides: Partial<LabPr> & PrExtras = {}): LabPr {
  return { ...pr(number), review: "review_required", mergeable: "mergeable", ...overrides };
}

const codex = { agentName: "codex", agentLabel: "Codex" } as const;

/** One row per PR situation, mixed with the agent states they have to coexist with. */
const PR_WEBMUX: ProjectWorktreeList = {
  prefix: "webmux",
  name: "webmux",
  error: null,
  worktrees: [
    wt("webmux", "design/sidebar-lab", { agent: "working", dirty: true }),
    wt("webmux", "feat-worktree-list-all-projects", {
      label: "Hub listing for all projects",
      agent: "working",
      prs: [labPr(41, { isDraft: true, ciStatus: "pending", ciChecks: checks("sspp") })],
    }),
    wt("webmux", "feat-worktree-list-all-projects-api-tests", {
      baseBranch: "feat-worktree-list-all-projects",
      agent: "idle",
      ...codex,
      prs: [labPr(43, { ciStatus: "pending", ciChecks: checks("ssspp") })],
    }),
    wt("webmux", "fix-terminal-test-kills-live-tmux", {
      agent: "waiting",
      ...codex,
      prs: [labPr(38, { ciStatus: "failed", ciChecks: checks("sfsss"), comments: comments(2) })],
    }),
    wt("webmux", "feat/linear-auto-create-tickets-for-every-project-in-watch-teams", {
      agent: "done",
      prs: [labPr(37, { review: "changes_requested", ciChecks: checks("sssss"), comments: comments(3) })],
    }),
    wt("webmux", "remove-services-from-config", {
      agent: "idle",
      prs: [labPr(39, { review: "approved", ciChecks: checks("ssssss"), comments: comments(1) })],
    }),
    wt("webmux", "refactor-project-cache", {
      agent: "idle",
      mux: "",
      prs: [labPr(36, { mergeable: "conflicting", ciChecks: checks("sssss") })],
    }),
    wt("webmux", "remove-merge-button-fix-toast-links", { agent: "done", prs: [labPr(35, { state: "merged", ciChecks: checks("sssss") })] }),
    wt("webmux", "spike-xterm-webgl", { agent: "idle", mux: "", prs: [labPr(33, { state: "closed", ciStatus: "failed", ciChecks: checks("fs") })] }),
    wt("webmux", "feat/shared-api-contract", {
      label: "Shared API contract",
      agent: "error",
      prs: [
        labPr(42, { ciChecks: checks("sssss") }),
        labPr(12, { repo: "site", isDraft: true, ciStatus: "pending", ciChecks: checks("p"), url: "https://github.com/acme/site/pull/12" }),
      ],
    }),
    wt("webmux", "chore/bump-deps", { agent: "idle", prs: [labPr(40, { ciStatus: "none" })] }),
    wt("webmux", "feat/command-palette", { agent: "", mux: "", creating: true, creationPhase: "running_post_create_hook" }),
    wt("webmux", "docs-typo-in-quickstart", { agent: "idle", mux: "", archived: true, prs: [labPr(31, { state: "merged" })] }),
  ],
};

export const PR_MOCK_PROJECTS: ProjectWorktreeList[] = [PR_WEBMUX, ...MOCK_PROJECTS.slice(1)];

export const PR_MOCK_NOTIFIED: ReadonlySet<string> = new Set([
  worktreeKey({ project: "webmux", branch: "feat/linear-auto-create-tickets-for-every-project-in-watch-teams" }),
  worktreeKey({ project: "webmux", branch: "remove-merge-button-fix-toast-links" }),
]);

export const PR_MOCK_FAVORITES: ReadonlySet<string> = new Set([
  worktreeKey({ project: "webmux", branch: "remove-services-from-config" }),
]);

/** What each mock row stands for, shown above the variants. */
export const PR_SCENARIOS: Array<[string, string]> = [
  ["design/sidebar-lab", "No PR · working"],
  ["Hub listing for all projects", "Draft #41, CI running · working"],
  ["…-api-tests (sub-worktree)", "Open #43, CI running · idle"],
  ["fix-terminal-test-kills-live-tmux", "Open #38, CI failed, 2 comments · waiting"],
  ["feat/linear-auto-create-… (long)", "Open #37, changes requested, 3 comments · unread"],
  ["remove-services-from-config ★", "Open #39, approved + green = ready · idle"],
  ["refactor-project-cache", "Open #36, merge conflicts · closed session"],
  ["remove-merge-button-fix-toast-links", "Merged #35 · unread"],
  ["spike-xterm-webgl", "Closed #33 · closed session"],
  ["Shared API contract", "#42 awaiting review + linked site#12 draft · error"],
  ["chore/bump-deps", "Open #40, no CI configured · idle"],
  ["feat/command-palette", "No PR · creating"],
];
