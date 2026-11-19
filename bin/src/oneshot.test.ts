import { afterEach, describe, expect, it } from "bun:test";
import type { AgentSummary } from "@webmux/api-contract";
import { agentStreamsConversation, parseOneshotArgs, runOneshot } from "./oneshot";
import { resolveProjectRoot } from "./shared";

describe("parseOneshotArgs", () => {
  it("requires --prompt for new oneshots", () => {
    expect(() => parseOneshotArgs(["feature/search"])).toThrow("oneshot requires --prompt");
  });

  it("parses positional branch and prompt", () => {
    const parsed = parseOneshotArgs(["feature/search", "--prompt", "Fix bug"]);
    expect(parsed?.body.branch).toBe("feature/search");
    expect(parsed?.body.prompt).toBe("Fix bug");
    expect(parsed?.resume).toBe(false);
  });

  it("parses --keep-open", () => {
    const parsed = parseOneshotArgs(["feature/search", "--prompt", "Fix bug", "--keep-open"]);
    expect(parsed?.keepOpen).toBe(true);
  });

  it("rejects --resume without --prompt", () => {
    expect(() => parseOneshotArgs(["--resume", "feature/search"]))
      .toThrow("--resume requires --prompt");
  });

  it("parses --resume with follow-up prompt", () => {
    const parsed = parseOneshotArgs(["--resume", "feature/search", "--prompt", "you're stuck, continue"]);
    expect(parsed?.resume).toBe(true);
    expect(parsed?.prompt).toBe("you're stuck, continue");
  });

  it("rejects --resume without a branch", () => {
    expect(() => parseOneshotArgs(["--resume="])).toThrow("--resume requires a branch name");
  });

  it("rejects positional branch combined with --resume of a different branch", () => {
    expect(() => parseOneshotArgs(["other", "--resume", "feature/search", "--prompt", "x"]))
      .toThrow("Cannot pass both a positional branch and --resume");
  });

  it("parses agent, base, profile, env overrides", () => {
    const parsed = parseOneshotArgs([
      "feature/search",
      "--prompt", "Fix bug",
      "--agent", "codex",
      "--base", "main",
      "--profile", "sandbox",
      "--env", "FOO=bar",
      "--env=BAZ=qux",
    ]);
    expect(parsed?.body.agent).toBe("codex");
    expect(parsed?.body.baseBranch).toBe("main");
    expect(parsed?.body.profile).toBe("sandbox");
    expect(parsed?.body.envOverrides).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("returns null for --help", () => {
    expect(parseOneshotArgs(["--help"])).toBeNull();
  });

  it("--linear with an issue id sets both seed and post target (round-trip)", () => {
    const parsed = parseOneshotArgs(["--linear", "ENG-42"]);
    expect(parsed?.fromLinearIssueId).toBe("ENG-42");
    expect(parsed?.postToLinearTarget).toEqual({ kind: "issue", issueId: "ENG-42" });
    expect(parsed?.resume).toBe(false);
  });

  it("--linear with a team key sets only the post target", () => {
    const parsed = parseOneshotArgs(["feature/search", "--prompt", "Fix", "--linear", "ENG"]);
    expect(parsed?.fromLinearIssueId).toBeNull();
    expect(parsed?.postToLinearTarget).toEqual({ kind: "team", teamKey: "ENG" });
  });

  it("rejects invalid --linear values", () => {
    expect(() => parseOneshotArgs(["feature/search", "--prompt", "Fix", "--linear", "eng-1"]))
      .toThrow("--linear expects either an issue id");
    expect(() => parseOneshotArgs(["feature/search", "--prompt", "Fix", "--linear", ""]))
      .toThrow("--linear expects either an issue id");
  });

  it("rejects --linear combined with --resume", () => {
    expect(() => parseOneshotArgs(["--resume", "feat/foo", "--linear", "ENG-12"]))
      .toThrow("Cannot use --resume with --linear <issue-id>");
  });

  it("accepts --branch as override alongside --linear (issue id)", () => {
    const parsed = parseOneshotArgs(["--linear", "ENG-12", "--branch", "feat/override"]);
    expect(parsed?.branch).toBe("feat/override");
    expect(parsed?.fromLinearIssueId).toBe("ENG-12");
  });

  it("rejects --branch with conflicting positional branch", () => {
    expect(() => parseOneshotArgs(["feat/positional", "--prompt", "Fix", "--branch", "feat/override"]))
      .toThrow("Conflicting branch values");
  });

  it("rejects --branch without --linear", () => {
    expect(() => parseOneshotArgs(["--prompt", "Fix", "--branch", "feat/override"]))
      .toThrow("--branch only applies with --linear");
  });

  it("rejects --branch with --resume with a precise message", () => {
    expect(() => parseOneshotArgs(["--resume", "feat/foo", "--branch", "feat/bar"]))
      .toThrow("Cannot use --branch with --resume");
  });
});

describe("agentStreamsConversation", () => {
  function agent(id: string, conversationHistory: boolean): AgentSummary {
    return {
      id,
      label: id,
      kind: "builtin",
      capabilities: {
        terminal: true,
        inAppChat: conversationHistory,
        conversationHistory,
        interrupt: conversationHistory,
        resume: true,
      },
    };
  }

  const agents = [agent("claude", true), agent("codex", true), agent("opencode", false), agent("pi", false)];

  it("streams for agents with a readable transcript", () => {
    expect(agentStreamsConversation(agents, "claude")).toBe(true);
    expect(agentStreamsConversation(agents, "codex")).toBe(true);
  });

  it("skips streaming for agents without one, and for unknown or missing agents", () => {
    expect(agentStreamsConversation(agents, "opencode")).toBe(false);
    expect(agentStreamsConversation(agents, "pi")).toBe(false);
    expect(agentStreamsConversation(agents, "gemini")).toBe(false);
    expect(agentStreamsConversation(agents, null)).toBe(false);
  });
});

describe("runOneshot --resume", () => {
  const originalFetch = globalThis.fetch;
  const originalWrite = process.stderr.write;
  const originalStdoutWrite = process.stdout.write;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.stderr.write = originalWrite;
    process.stdout.write = originalStdoutWrite;
  });

  /** Fake server: one served project at this repo, one worktree `feature/search` with id `wt_1`;
   *  opening a worktree fails so the run stops right after the open call. */
  function stubServer(calls: string[]): void {
    globalThis.fetch = Object.assign(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push(`${init?.method ?? "GET"} ${url.pathname}`);
      if (url.pathname === "/api/projects") {
        return Response.json({ projects: [{ prefix: "myproject", name: "myproject", path: resolveProjectRoot() }] });
      }
      if (url.pathname.endsWith("/worktrees")) {
        return Response.json({ worktrees: [{ id: "wt_1", branch: "feature/search" }] });
      }
      return Response.json({ error: "stop here" }, { status: 409 });
    }, { preconnect: originalFetch.preconnect });
  }

  function captureStderr(): string[] {
    const lines: string[] = [];
    process.stdout.write = (() => true) as typeof process.stdout.write;
    process.stderr.write = ((chunk: string) => {
      lines.push(chunk);
      return true;
    }) as typeof process.stderr.write;
    return lines;
  }

  it("opens the resumed worktree by its id", async () => {
    const calls: string[] = [];
    stubServer(calls);
    captureStderr();
    const parsed = parseOneshotArgs(["--resume", "feature/search", "--prompt", "Keep going"]);
    if (!parsed) throw new Error("expected parsed args");

    expect(await runOneshot(parsed, 5111)).toBe(1);
    expect(calls).toContain("POST /api/projects/myproject/worktrees/wt_1/open");
  });

  it("names the typed branch when no worktree matches it", async () => {
    const calls: string[] = [];
    stubServer(calls);
    const stderr = captureStderr();
    const parsed = parseOneshotArgs(["--resume", "feature/missing", "--prompt", "Keep going"]);
    if (!parsed) throw new Error("expected parsed args");

    expect(await runOneshot(parsed, 5111)).toBe(1);
    expect(calls.some((call) => call.endsWith("/open"))).toBe(false);
    expect(stderr.join("")).toContain("Worktree not found: feature/missing");
  });
});
