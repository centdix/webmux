import type { CiCheck, PrEntry, WorktreeInfo } from "../lib/types";

/** Fields `gh pr list --json` can return but `pr-service.ts` doesn't request
 *  yet (`reviewDecision`, `mergeable`). Mocked here; real rows have neither. */
export interface PrExtras {
  review?: "approved" | "changes_requested" | "review_required";
  mergeable?: "mergeable" | "conflicting" | "unknown";
}

export type LabPr = PrEntry & PrExtras;

/** One word for where a PR stands, most urgent first. */
export type PrStatus =
  | "conflicts"
  | "ci-failed"
  | "changes"
  | "ready"
  | "ci-pending"
  | "review"
  | "draft"
  | "merged"
  | "closed";

const RANK: PrStatus[] = ["conflicts", "ci-failed", "changes", "ready", "ci-pending", "review", "draft", "merged", "closed"];

export function prStatusOf(pr: LabPr): PrStatus {
  if (pr.state === "merged") return "merged";
  if (pr.state === "closed") return "closed";
  if (pr.mergeable === "conflicting") return "conflicts";
  if (pr.ciStatus === "failed") return "ci-failed";
  if (pr.review === "changes_requested") return "changes";
  if (pr.isDraft) return "draft";
  if (pr.ciStatus === "pending") return "ci-pending";
  if (pr.review === "approved") return "ready";
  return "review";
}

export interface PrStatusMeta {
  /** Full sentence for tooltips and the second line. */
  label: string;
  /** One word for tight right-aligned slots. */
  word: string;
  text: string;
  bg: string;
  /** Soft fill behind `text` (pills). */
  tint: string;
  /** Needs `reviewDecision`/`mergeable` from the backend. */
  needsBackend?: boolean;
}

export const PR_STATUS: Record<PrStatus, PrStatusMeta> = {
  conflicts: { label: "Merge conflicts", word: "Conflicts", text: "text-danger", bg: "bg-danger", tint: "bg-danger/15", needsBackend: true },
  "ci-failed": { label: "CI failed", word: "CI failed", text: "text-danger", bg: "bg-danger", tint: "bg-danger/15" },
  changes: { label: "Changes requested", word: "Changes", text: "text-warning", bg: "bg-warning", tint: "bg-warning/15", needsBackend: true },
  ready: { label: "Ready to merge", word: "Ready", text: "text-success", bg: "bg-success", tint: "bg-success/15", needsBackend: true },
  "ci-pending": { label: "CI running", word: "CI…", text: "text-muted", bg: "bg-muted", tint: "bg-muted/15" },
  review: { label: "Awaiting review", word: "Review", text: "text-accent", bg: "bg-accent", tint: "bg-accent/15" },
  draft: { label: "Draft", word: "Draft", text: "text-muted", bg: "bg-muted", tint: "bg-muted/15" },
  merged: { label: "Merged", word: "Merged", text: "text-merged", bg: "bg-merged", tint: "bg-merged/15" },
  closed: { label: "Closed", word: "Closed", text: "text-muted", bg: "bg-muted", tint: "bg-muted/15" },
};

export function labPrs(wt: WorktreeInfo): LabPr[] {
  return wt.prs;
}

/** A row's PRs, most urgent first. */
export function rankedPrs(wt: WorktreeInfo): LabPr[] {
  return [...labPrs(wt)].sort((a, b) => RANK.indexOf(prStatusOf(a)) - RANK.indexOf(prStatusOf(b)));
}

export function prRef(pr: PrEntry): string {
  return pr.repo ? `${pr.repo}#${pr.number}` : `#${pr.number}`;
}

/** Git state, the shape of the GitHub icon. */
export type PrShape = "open" | "draft" | "merged" | "closed";

export function prShapeOf(pr: PrEntry): PrShape {
  if (pr.state === "merged") return "merged";
  if (pr.state === "closed") return "closed";
  return pr.isDraft ? "draft" : "open";
}

export const PR_SHAPE_TEXT: Record<PrShape, string> = {
  open: "text-success",
  draft: "text-muted",
  merged: "text-merged",
  closed: "text-danger",
};

export const CI_TEXT: Record<PrEntry["ciStatus"], string> = {
  success: "text-success",
  failed: "text-danger",
  pending: "text-warning",
  none: "text-muted",
};

export const CHECK_BG: Record<CiCheck["status"], string> = {
  success: "bg-success",
  failed: "bg-danger",
  pending: "bg-warning",
  skipped: "bg-muted/50",
};

export function checkCounts(pr: PrEntry): Record<CiCheck["status"], number> {
  const counts = { success: 0, failed: 0, pending: 0, skipped: 0 };
  for (const check of pr.ciChecks) counts[check.status] += 1;
  return counts;
}

export function checksSummary(pr: PrEntry): string {
  if (pr.ciChecks.length === 0) return pr.ciStatus === "none" ? "No checks" : `CI ${pr.ciStatus}`;
  const counts = checkCounts(pr);
  return [
    counts.failed ? `${counts.failed} failed` : null,
    counts.pending ? `${counts.pending} running` : null,
    counts.success ? `${counts.success} passed` : null,
  ].filter(Boolean).join(" · ");
}

export function reviewLabel(pr: LabPr): string {
  if (pr.review === "approved") return "Approved";
  if (pr.review === "changes_requested") return "Changes requested";
  return "Review required";
}

export function commentsLabel(pr: PrEntry): string {
  const inline = pr.comments.filter((c) => c.type === "inline").length;
  const general = pr.comments.length - inline;
  if (pr.comments.length === 0) return "None";
  return [inline ? `${inline} inline` : null, general ? `${general} conversation` : null].filter(Boolean).join(" · ");
}

export function prTitle(pr: LabPr): string {
  return `${prRef(pr)} · ${PR_STATUS[prStatusOf(pr)].label}`;
}

export type PrIconKind =
  | PrShape
  | "ci-success"
  | "ci-failed"
  | "ci-pending"
  | "approved"
  | "changes"
  | "conflicts"
  | "comment";

export function ciIconOf(pr: PrEntry): PrIconKind | null {
  if (pr.state !== "open" || pr.ciStatus === "none") return null;
  return `ci-${pr.ciStatus}`;
}

/** The icon that best stands for a status on its own. */
export const PR_STATUS_ICON: Record<PrStatus, PrIconKind> = {
  conflicts: "conflicts",
  "ci-failed": "ci-failed",
  changes: "changes",
  ready: "ci-success",
  "ci-pending": "ci-pending",
  review: "open",
  draft: "draft",
  merged: "merged",
  closed: "closed",
};
