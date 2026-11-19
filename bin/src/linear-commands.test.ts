import { afterEach, describe, expect, it } from "bun:test";
import { parseLinearArgs, parseLinearTargetArg, runLinearCommand } from "./linear-commands";

describe("parseLinearTargetArg", () => {
  it("recognises team keys", () => {
    expect(parseLinearTargetArg("ENG")).toEqual({ kind: "team", teamKey: "ENG" });
  });

  it("rejects issue ids with a helpful pointer to --linear", () => {
    expect(() => parseLinearTargetArg("ENG-42")).toThrow("--linear ENG-42");
  });

  it("throws on invalid input", () => {
    expect(() => parseLinearTargetArg("eng-1")).toThrow("Invalid Linear team key");
    expect(() => parseLinearTargetArg("")).toThrow("Invalid Linear team key");
  });
});

describe("parseLinearArgs", () => {
  it("returns null for help", () => {
    expect(parseLinearArgs([])).toBeNull();
    expect(parseLinearArgs(["--help"])).toBeNull();
  });

  it("rejects post with an issue id (use --linear instead)", () => {
    expect(() => parseLinearArgs(["post", "feat/foo", "ENG-42"])).toThrow("--linear ENG-42");
  });

  it("parses post with team key", () => {
    const parsed = parseLinearArgs(["post", "feat/foo", "ENG"]);
    expect(parsed?.subcommand).toBe("post");
    expect(parsed?.post.branch).toBe("feat/foo");
    expect(parsed?.post.target).toEqual({ kind: "team", teamKey: "ENG" });
  });

  it("parses post with team key and --title", () => {
    const parsed = parseLinearArgs(["post", "feat/foo", "ENG", "--title", "Investigate flaky test"]);
    expect(parsed?.post.target).toEqual({
      kind: "team",
      teamKey: "ENG",
      title: "Investigate flaky test",
    });
  });

  it("rejects unknown subcommand", () => {
    expect(() => parseLinearArgs(["pull", "ENG-1"])).toThrow("Unknown linear subcommand: pull");
  });

  it("requires branch + team key", () => {
    expect(() => parseLinearArgs(["post"])).toThrow("requires a <branch>");
    expect(() => parseLinearArgs(["post", "feat/foo"])).toThrow("requires a <team-key>");
  });
});

describe("runLinearCommand", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("resolves the branch to its worktree id and posts on the id route", async () => {
    const calls: string[] = [];
    globalThis.fetch = Object.assign(async (input: string | URL | Request, init?: RequestInit) => {
      calls.push(`${init?.method} ${String(input)}`);
      return Response.json({ ok: true, issueId: "i1", issueUrl: "https://linear.app/i1", commentUrl: null, attachmentUrl: "https://linear.app/a1" });
    }, { preconnect: originalFetch.preconnect });
    const resolved: string[] = [];

    const exitCode = await runLinearCommand(["post", "feat/foo", "ENG"], 5111, {
      resolveServedProject: async () => "myproject",
      resolveWorktreeId: async (branch) => {
        resolved.push(branch);
        return "wt_1";
      },
    });

    expect(exitCode).toBe(0);
    expect(resolved).toEqual(["feat/foo"]);
    expect(calls).toEqual(["POST http://localhost:5111/api/projects/myproject/worktrees/wt_1/linear/post"]);
  });

  it("names the typed branch when it matches no worktree", async () => {
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (message: string) => errors.push(message);
    try {
      const exitCode = await runLinearCommand(["post", "feat/missing", "ENG"], 5111, {
        resolveServedProject: async () => "myproject",
        resolveWorktreeId: async (branch) => {
          throw new Error(`Worktree not found: ${branch}`);
        },
      });
      expect(exitCode).toBe(1);
    } finally {
      console.error = originalError;
    }
    expect(errors).toEqual(["Worktree not found: feat/missing"]);
  });
});
