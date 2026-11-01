import type { PrEntry, WorktreeCreationPhase, WorktreeInfo } from "./types";
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

/** A row's name while it is being created: its current phase. */
export function creatingLabel(phase: WorktreeCreationPhase | null): string {
  return `${worktreeCreationPhaseLabel(phase)}…`;
}

export function attentionLabel(attention: Attention, worktree: WorktreeInfo): string {
  switch (attention) {
    case "waiting": return "Waiting for input";
    case "error": return "Agent error";
    case "unread": return "Finished, unread";
    case "working": return "Working";
    case "creating": return creatingLabel(worktree.creationPhase);
    case "closed": return "Closed";
    case "idle": return "Idle";
  }
}

/** What a worktree's PR asks of you, most urgent first. */
export type PrState = "open" | "draft" | "merged" | "closed";

export function prStateOf(pr: PrEntry): PrState {
  if (pr.state === "merged") return "merged";
  if (pr.state === "closed") return "closed";
  return pr.isDraft ? "draft" : "open";
}

export const PR_STATE_TEXT_CLASS: Record<PrState, string> = {
  open: "text-success",
  draft: "text-muted",
  merged: "text-merged",
  closed: "text-danger",
};

const PR_STATE_TEXT: Record<PrState, string> = { open: "Open", draft: "Draft", merged: "Merged", closed: "Closed" };

export function prStateLabel(pr: PrEntry): string {
  return `#${pr.number}${pr.repo ? ` (${pr.repo})` : ""} · ${PR_STATE_TEXT[prStateOf(pr)]}`;
}

/** The PR a row shows: its open one, else the first. */
export function rowPr(worktree: WorktreeInfo): PrEntry | null {
  return worktree.prs.find((entry) => entry.state === "open") ?? worktree.prs[0] ?? null;
}
