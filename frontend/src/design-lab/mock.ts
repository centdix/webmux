import type { LinkedLinearIssue, PrEntry, ProjectWorktreeList, WorktreeInfo } from "../lib/types";
import { worktreeKey } from "../lib/worktree-ref";

function wt(project: string, branch: string, overrides: Partial<WorktreeInfo> = {}): WorktreeInfo {
  return {
    project,
    branch,
    label: null,
    archived: false,
    agent: "idle",
    mux: "✓",
    path: `/home/dev/${project}__worktrees/${branch}`,
    dir: null,
    dirty: false,
    unpushed: false,
    status: "running",
    elapsed: "12m",
    profile: "default",
    agentName: "claude",
    agentLabel: "Claude",
    agentTerminalStale: false,
    services: [],
    paneCount: 2,
    prs: [],
    linearIssue: null,
    creating: false,
    creationPhase: null,
    source: "ui",
    oneshot: null,
    tabs: [],
    activeTabId: null,
    ...overrides,
  };
}

function pr(number: number, overrides: Partial<PrEntry> = {}): PrEntry {
  return {
    repo: "",
    number,
    state: "open",
    isDraft: false,
    url: `https://github.com/acme/repo/pull/${number}`,
    updatedAt: "2026-10-31T10:00:00Z",
    ciStatus: "success",
    ciChecks: [],
    comments: [],
    ...overrides,
  };
}

function comments(count: number): PrEntry["comments"] {
  return Array.from({ length: count }, (_, i) => ({
    type: "inline" as const,
    author: i % 2 ? "rubenfiszel" : "hugocasa",
    body: "Could we avoid the extra fetch here?",
    createdAt: "2026-10-31T09:00:00Z",
    path: "src/server.ts",
    line: 40 + i,
  }));
}

function linear(identifier: string, state: string, color: string): LinkedLinearIssue {
  return { identifier, url: `https://linear.app/acme/issue/${identifier}`, state: { name: state, color, type: "started" } };
}

const codex = { agentName: "codex", agentLabel: "Codex" } as const;

export const MOCK_PROJECTS: ProjectWorktreeList[] = [
  {
    prefix: "webmux",
    name: "webmux",
    error: null,
    worktrees: [
      wt("webmux", "feat-worktree-list-all-projects", {
        label: "Hub listing for all projects",
        agent: "working",
        elapsed: "4m",
        prs: [pr(41, { isDraft: true, ciStatus: "pending" })],
        linearIssue: linear("WMX-112", "In Progress", "#f2c94c"),
        services: [{ name: "web", port: 4100, running: true }, { name: "api", port: 4101, running: true }],
      }),
      wt("webmux", "feat-worktree-list-all-projects-api-tests", {
        baseBranch: "feat-worktree-list-all-projects",
        agent: "done",
        ...codex,
      }),
      wt("webmux", "fix-terminal-test-kills-live-tmux", {
        agent: "waiting",
        ...codex,
        prs: [pr(38, { ciStatus: "failed", comments: comments(2) })],
        dirty: true,
      }),
      wt("webmux", "remove-merge-button-fix-toast-links", {
        agent: "done",
        prs: [pr(35, { state: "merged" })],
      }),
      wt("webmux", "design/sidebar-lab", { agent: "working", dirty: true, profile: "sandbox" }),
      wt("webmux", "feat/linear-auto-create-tickets-for-every-project-in-watch-teams", {
        agent: "idle",
        prs: [pr(37)],
        linearIssue: linear("WMX-98", "In Review", "#5e6ad2"),
      }),
      wt("webmux", "chore/bump-deps", { agent: "error", unpushed: true }),
      wt("webmux", "oneshot/ENG-482-fix-flaky-ci", {
        agent: "working",
        source: "oneshot",
        oneshot: { autoCloseOnDone: true },
        ...codex,
      }),
      wt("webmux", "refactor-project-cache", { agent: "idle", mux: "" }),
      wt("webmux", "spike-xterm-webgl", { agent: "idle", mux: "", archived: true }),
      wt("webmux", "feat/command-palette", {
        agent: "",
        mux: "",
        creating: true,
        creationPhase: "running_post_create_hook",
      }),
    ],
  },
  {
    prefix: "image-generator",
    name: "image-generator",
    error: null,
    worktrees: [
      wt("image-generator", "main-ui-polish", {
        label: "Gallery polish",
        agent: "done",
        prs: [pr(12, { comments: comments(3) })],
      }),
    ],
  },
  {
    prefix: "windmill",
    name: "windmill",
    error: null,
    worktrees: [
      wt("windmill", "perf/job-queue-index", {
        label: "Job queue index",
        agent: "waiting",
        prs: [pr(7021, { repo: "", ciStatus: "pending" })],
      }),
      wt("windmill", "feat/flow-step-retry-policy", {
        agent: "working",
        ...codex,
        prs: [pr(7004, { isDraft: true, ciStatus: "none" })],
      }),
      wt("windmill", "fix/s3-upload-timeout", { agent: "idle", prs: [pr(6990, { state: "closed", ciStatus: "failed" })] }),
      wt("windmill", "docs-typo-in-quickstart", { agent: "done", mux: "", archived: true, prs: [pr(6950, { state: "merged" })] }),
      wt("windmill", "feat/workspace-quota", { agent: "", mux: "", creating: true, creationPhase: "creating_worktree" }),
    ],
  },
  {
    prefix: "billing-api",
    name: "billing-api",
    error: "fatal: not a git repository: /srv/billing-api (ENOENT)",
    worktrees: [],
  },
];

/** Worktrees with an unread notification (agent stopped, PR opened…). */
export const MOCK_NOTIFIED: ReadonlySet<string> = new Set([
  worktreeKey({ project: "webmux", branch: "remove-merge-button-fix-toast-links" }),
  worktreeKey({ project: "image-generator", branch: "main-ui-polish" }),
]);

export const MOCK_FAVORITES: ReadonlySet<string> = new Set([
  worktreeKey({ project: "webmux", branch: "feat/linear-auto-create-tickets-for-every-project-in-watch-teams" }),
]);
