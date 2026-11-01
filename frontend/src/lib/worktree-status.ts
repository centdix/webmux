import type { PrEntry, WorktreeInfo } from "./types";
import { worktreeCreationPhaseLabel } from "./utils";
import { overflowStatusOf } from "./worktree-list";

/** The single state a sidebar row shows at a glance, most urgent first. */
export type Attention = "waiting" | "error" | "unread" | "working" | "creating" | "closed" | "idle";

export function attentionOf(worktree: WorktreeInfo, notified: ReadonlySet<string>): Attention {
  if (worktree.creating) return "creating";
  const overflow = overflowStatusOf(worktree, notified);
  if (overflow === "done-unread") return "unread";
  if (overflow) return overflow;
  if (worktree.mux !== "✓") return "closed";
  if (worktree.agent === "working") return "working";
  return "idle";
}

export function attentionLabel(attention: Attention, worktree: WorktreeInfo): string {
  switch (attention) {
    case "waiting": return "Waiting for input";
    case "error": return "Agent error";
    case "unread": return "Finished, unread";
    case "working": return "Working";
    case "creating": return `${worktreeCreationPhaseLabel(worktree.creationPhase)}…`;
    case "closed": return "Closed";
    case "idle": return "Idle";
  }
}

/** What a worktree's PR asks of you, most urgent first. */
export type PrSignal = "ci-failed" | "comments" | "ready" | "ci-pending" | "draft" | "merged" | "closed";

export function prSignalOf(pr: PrEntry): PrSignal {
  if (pr.state === "merged") return "merged";
  if (pr.state === "closed") return "closed";
  if (pr.ciStatus === "failed") return "ci-failed";
  if (pr.comments.length > 0) return "comments";
  if (pr.isDraft) return "draft";
  if (pr.ciStatus === "pending") return "ci-pending";
  return "ready";
}

export const PR_SIGNAL_TEXT_CLASS: Record<PrSignal, string> = {
  "ci-failed": "text-danger",
  comments: "text-warning",
  ready: "text-success",
  "ci-pending": "text-muted",
  draft: "text-muted",
  merged: "text-merged",
  closed: "text-muted",
};

export function prSignalLabel(pr: PrEntry): string {
  const signal = prSignalOf(pr);
  const text = {
    "ci-failed": "CI failed",
    comments: `${pr.comments.length} review comments`,
    ready: "Ready to merge",
    "ci-pending": "CI running",
    draft: "Draft",
    merged: "Merged",
    closed: "Closed",
  }[signal];
  return `#${pr.number} · ${text}`;
}

const ACTIONABLE_SIGNALS: ReadonlySet<PrSignal> = new Set(["ci-failed", "comments", "ready", "merged"]);

/** The PR a one-line row marks: the open one (else the first), only when it
 *  asks for action (CI failed, comments, ready to merge) or can be cleaned up
 *  (merged). */
export function actionablePr(worktree: WorktreeInfo): PrEntry | null {
  const pr = worktree.prs.find((entry) => entry.state === "open") ?? worktree.prs[0] ?? null;
  return pr && ACTIONABLE_SIGNALS.has(prSignalOf(pr)) ? pr : null;
}
