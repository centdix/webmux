import { describe, expect, it } from "bun:test";
import { parseRuntimeEvent } from "../domain/events";

describe("parseRuntimeEvent", () => {
  it("parses valid runtime events", () => {
    expect(parseRuntimeEvent({
      worktreeId: "wt_search",
      branch: "feature/search",
      type: "agent_status_changed",
      lifecycle: "idle",
    })).toEqual({
      worktreeId: "wt_search",
      type: "agent_status_changed",
      lifecycle: "idle",
    });
  });

  it("accepts events without a branch", () => {
    expect(parseRuntimeEvent({
      worktreeId: "wt_search",
      type: "agent_stopped",
    })).toEqual({
      worktreeId: "wt_search",
      type: "agent_stopped",
    });
  });

  it("accepts and drops the branch sent by older hook scripts", () => {
    expect(parseRuntimeEvent({
      worktreeId: "wt_search",
      branch: "feature/stale",
      type: "pr_opened",
      url: "https://github.com/org/repo/pull/1",
    })).toEqual({
      worktreeId: "wt_search",
      type: "pr_opened",
      url: "https://github.com/org/repo/pull/1",
    });
  });

  it("rejects malformed runtime events", () => {
    expect(parseRuntimeEvent(null)).toBeNull();
    expect(parseRuntimeEvent({
      worktreeId: "wt_search",
      branch: "feature/search",
      type: "agent_started",
    })).toBeNull();
    expect(parseRuntimeEvent({
      worktreeId: "wt_search",
      branch: "feature/search",
      type: "title_changed",
      title: "ignored",
    })).toBeNull();
    expect(parseRuntimeEvent({
      worktreeId: "wt_search",
      branch: "feature/search",
      type: "agent_status_changed",
      lifecycle: "closed",
    })).toBeNull();
    expect(parseRuntimeEvent({
      worktreeId: "wt_search",
      branch: "feature/search",
      type: "runtime_error",
    })).toBeNull();
  });
});
