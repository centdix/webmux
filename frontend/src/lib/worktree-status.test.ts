import { describe, expect, it } from "vitest";
import type { PrEntry, WorktreeInfo } from "./types";
import { attentionLabel, attentionOf, prStateLabel, prStateOf, rowPr } from "./worktree-status";

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

describe("PR state", () => {
  it("reduces a PR to its state", () => {
    expect(prStateOf(createPr())).toBe("open");
    expect(prStateOf(createPr({ isDraft: true, ciStatus: "failed" }))).toBe("draft");
    expect(prStateOf(createPr({ state: "merged" }))).toBe("merged");
    expect(prStateOf(createPr({ state: "closed", isDraft: true }))).toBe("closed");
  });

  it("labels the PR with its number, linked repo and state", () => {
    expect(prStateLabel(createPr({ ciStatus: "failed" }))).toBe("#7 · Open");
    expect(prStateLabel(createPr({ repo: "shared", state: "merged" }))).toBe("#7 (shared) · Merged");
  });

  it("shows every row's PR, preferring the open one", () => {
    expect(rowPr(createWorktree())).toBeNull();
    const draft = createPr({ isDraft: true });
    expect(rowPr(createWorktree({ prs: [draft] }))).toBe(draft);
    const merged = createPr({ number: 1, state: "merged" });
    const open = createPr({ number: 2 });
    expect(rowPr(createWorktree({ prs: [merged] }))).toBe(merged);
    expect(rowPr(createWorktree({ prs: [merged, open] }))).toBe(open);
  });
});
