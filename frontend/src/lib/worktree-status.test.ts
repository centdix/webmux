import { describe, expect, it } from "vitest";
import type { PrEntry, WorktreeInfo } from "./types";
import { actionablePr, attentionLabel, attentionOf, prSignalLabel, prSignalOf } from "./worktree-status";

function createWorktree(overrides: Partial<WorktreeInfo> = {}): WorktreeInfo {
  return {
    project: "webmux",
    branch: "feat",
    label: null,
    archived: false,
    agent: "idle",
    mux: "✓",
    path: "/repo/feat",
    dir: "/repo/feat",
    dirty: false,
    unpushed: false,
    status: "idle",
    elapsed: "",
    profile: null,
    agentName: null,
    agentLabel: null,
    agentTerminalStale: false,
    services: [],
    paneCount: 1,
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

function createPr(overrides: Partial<PrEntry> = {}): PrEntry {
  return {
    repo: "",
    number: 7,
    state: "open",
    isDraft: false,
    url: "https://example.com/pr/7",
    updatedAt: "",
    ciStatus: "success",
    ciChecks: [],
    comments: [],
    ...overrides,
  };
}

const none = new Set<string>();

describe("attentionOf", () => {
  it("ranks creation, then the agent's needs, then closed, working and idle", () => {
    expect(attentionOf(createWorktree({ creating: true, agent: "waiting" }), none)).toBe("creating");
    expect(attentionOf(createWorktree({ agent: "waiting" }), none)).toBe("waiting");
    expect(attentionOf(createWorktree({ agent: "error" }), none)).toBe("error");
    expect(attentionOf(createWorktree({ agent: "done" }), new Set(["webmux:feat"]))).toBe("unread");
    expect(attentionOf(createWorktree({ agent: "done" }), none)).toBe("idle");
    expect(attentionOf(createWorktree({ agent: "waiting", mux: "" }), none)).toBe("closed");
    expect(attentionOf(createWorktree({ agent: "working" }), none)).toBe("working");
  });

  it("labels the creation phase", () => {
    const creating = createWorktree({ creating: true, creationPhase: "preparing_runtime" });
    expect(attentionLabel("creating", creating)).toBe("Preparing runtime…");
    expect(attentionLabel("waiting", creating)).toBe("Waiting for input");
  });
});

describe("PR signals", () => {
  it("ranks what a PR asks of you", () => {
    expect(prSignalOf(createPr({ state: "merged" }))).toBe("merged");
    expect(prSignalOf(createPr({ state: "closed" }))).toBe("closed");
    expect(prSignalOf(createPr({ ciStatus: "failed", isDraft: true }))).toBe("ci-failed");
    expect(prSignalOf(createPr({ comments: [{ type: "comment", author: "a", body: "b", createdAt: "" }] }))).toBe("comments");
    expect(prSignalOf(createPr({ isDraft: true }))).toBe("draft");
    expect(prSignalOf(createPr({ ciStatus: "pending" }))).toBe("ci-pending");
    expect(prSignalOf(createPr())).toBe("ready");
    expect(prSignalLabel(createPr({ ciStatus: "failed" }))).toBe("#7 · CI failed");
  });

  it("marks only the PRs that ask for action or can be cleaned up, preferring the open one", () => {
    expect(actionablePr(createWorktree())).toBeNull();
    expect(actionablePr(createWorktree({ prs: [createPr({ isDraft: true })] }))).toBeNull();
    expect(actionablePr(createWorktree({ prs: [createPr({ ciStatus: "pending" })] }))).toBeNull();
    const merged = createPr({ number: 1, state: "merged" });
    const failing = createPr({ number: 2, ciStatus: "failed" });
    expect(actionablePr(createWorktree({ prs: [merged] }))).toBe(merged);
    expect(actionablePr(createWorktree({ prs: [merged, failing] }))).toBe(failing);
  });
});
