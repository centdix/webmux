import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrEntry } from "./types";

vi.mock("./api", () => {
  const client = { sendWorktreePrompt: vi.fn(async () => ({ ok: true })), fetchCiLogs: vi.fn() };
  return { projectApi: vi.fn(() => client) };
});

import CiDetailsDialog from "./CiDetailsDialog.svelte";
import CommentReviewDialog from "./CommentReviewDialog.svelte";
import { projectApi } from "./api";

const api = projectApi("myproject");

const originalDialogShowModal = HTMLDialogElement.prototype.showModal;
const originalDialogClose = HTMLDialogElement.prototype.close;

const pr: PrEntry = {
  repo: "org/repo",
  number: 7,
  state: "open",
  isDraft: false,
  reviewDecision: "none",
  url: "https://github.com/org/repo/pull/7",
  updatedAt: "2026-01-01T00:00:00Z",
  ciStatus: "failed",
  ciChecks: [{ name: "test", status: "failed", url: null, runId: 42 }],
  comments: [{ type: "comment", author: "reviewer", body: "Please rename this", createdAt: "2026-01-01T00:00:00Z" }],
};

describe("PR prompt dialogs send to the worktree by id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement): void {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement): void {
      this.open = false;
    });
  });

  afterEach(() => {
    cleanup();
    HTMLDialogElement.prototype.showModal = originalDialogShowModal;
    HTMLDialogElement.prototype.close = originalDialogClose;
  });

  it("CiDetailsDialog asks the agent to fix a check", async () => {
    vi.mocked(api.fetchCiLogs).mockResolvedValue({ logs: "test\tboom" });
    render(CiDetailsDialog, { props: { project: "myproject", pr, worktreeId: "wt-ci", onclose: vi.fn(), onfixsuccess: vi.fn() } });

    await fireEvent.click(screen.getByRole("button", { name: "View logs" }));
    await fireEvent.click(await screen.findByRole("button", { name: "Ask agent to fix" }));

    expect(api.sendWorktreePrompt).toHaveBeenCalledWith(expect.objectContaining({ params: { id: "wt-ci" } }));
  });

  it("CommentReviewDialog sends the selected comments", async () => {
    render(CommentReviewDialog, { props: { project: "myproject", pr, worktreeId: "wt-review", onclose: vi.fn(), onsendsuccess: vi.fn() } });

    await fireEvent.click(await screen.findByRole("button", { name: "Send 1 to agent" }));

    expect(api.sendWorktreePrompt).toHaveBeenCalledWith(expect.objectContaining({ params: { id: "wt-review" } }));
  });
});
