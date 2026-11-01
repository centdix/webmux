import type { PrEntry, ProjectWorktreeList, WorktreeInfo, WorktreeRef } from "../lib/types";
import { matchesWorktreeSearch, overflowStatusOf } from "../lib/worktree-list";
import { worktreeKey } from "../lib/worktree-ref";
import { worktreeCreationPhaseLabel } from "../lib/utils";

/** The single state a row shows at a glance, most urgent first. */
export type Attention = "waiting" | "error" | "unread" | "working" | "creating" | "closed" | "idle";

export const NEEDS_YOU: readonly Attention[] = ["waiting", "error", "unread"];

export function attentionOf(wt: WorktreeInfo, notified: ReadonlySet<string>): Attention {
  if (wt.creating) return "creating";
  const overflow = overflowStatusOf(wt, notified);
  if (overflow === "done-unread") return "unread";
  if (overflow) return overflow;
  if (wt.mux !== "✓") return "closed";
  if (wt.agent === "working") return "working";
  return "idle";
}

/** What a worktree's PR asks of you, most urgent first. */
export type PrSignal = "ci-failed" | "comments" | "ready" | "ci-pending" | "draft" | "merged" | "closed";

export function primaryPr(wt: WorktreeInfo): PrEntry | null {
  return wt.prs.find((pr) => pr.state === "open") ?? wt.prs[0] ?? null;
}

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

/** The PR to mark on a quiet one-line row: only when it asks for action or can be cleaned up. */
export function actionablePr(wt: WorktreeInfo): PrEntry | null {
  const pr = primaryPr(wt);
  if (!pr) return null;
  const signal = prSignalOf(pr);
  return signal === "ci-failed" || signal === "comments" || signal === "ready" || signal === "merged" ? pr : null;
}

/** PR signals worth a reason line or a "needs you" mark. */
export function prNeedsYou(signal: PrSignal | null): boolean {
  return signal === "ci-failed" || signal === "comments";
}

export function displayName(wt: WorktreeInfo): string {
  return wt.label ?? wt.branch;
}

const ATTENTION_REASON: Partial<Record<Attention, { text: string; tone: string }>> = {
  waiting: { text: "Waiting for input", tone: "text-warning" },
  error: { text: "Agent error", tone: "text-danger" },
  unread: { text: "Finished, unread", tone: "text-accent" },
};

function prReason(pr: PrEntry): { text: string; tone: string } | null {
  const signal = prSignalOf(pr);
  if (signal === "ci-failed") return { text: `CI failed on #${pr.number}`, tone: PR_SIGNAL_TEXT_CLASS[signal] };
  if (signal === "comments") return { text: `${pr.comments.length} comments on #${pr.number}`, tone: PR_SIGNAL_TEXT_CLASS[signal] };
  if (signal === "ready") return { text: `#${pr.number} ready to merge`, tone: PR_SIGNAL_TEXT_CLASS[signal] };
  if (signal === "merged") return { text: `#${pr.number} merged`, tone: PR_SIGNAL_TEXT_CLASS[signal] };
  return null;
}

/** Why a row deserves a look (agent state, then PR), or null when it doesn't. */
export function reasonOf(wt: WorktreeInfo, notified: ReadonlySet<string>): { text: string; tone: string } | null {
  const attention = attentionOf(wt, notified);
  if (attention === "creating") return { text: `${worktreeCreationPhaseLabel(wt.creationPhase)}…`, tone: "text-muted" };
  const pr = primaryPr(wt);
  const parts = [ATTENTION_REASON[attention] ?? null, pr ? prReason(pr) : null].filter((part) => part !== null);
  if (parts.length === 0) return null;
  return { text: parts.map((part) => part.text).join(" · "), tone: parts[0].tone };
}

export function needsYou(wt: WorktreeInfo, notified: ReadonlySet<string>): boolean {
  const pr = primaryPr(wt);
  return NEEDS_YOU.includes(attentionOf(wt, notified)) || (!wt.archived && prNeedsYou(pr ? prSignalOf(pr) : null));
}

export function isRunning(wt: WorktreeInfo, notified: ReadonlySet<string>): boolean {
  const attention = attentionOf(wt, notified);
  return attention === "working" || attention === "creating";
}

export function isReadyToMerge(wt: WorktreeInfo): boolean {
  const pr = primaryPr(wt);
  return !!pr && prSignalOf(pr) === "ready";
}

export function projectInitials(name: string): string {
  const parts = name.split(/[-_\s/]+/).filter(Boolean);
  const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return initials.toUpperCase();
}

/** Theme-token tints for project avatars, picked by project order. */
const PROJECT_TINTS = [
  "bg-accent/20 text-accent",
  "bg-merged/20 text-merged",
  "bg-success/20 text-success",
  "bg-warning/20 text-warning",
];

export function projectTint(index: number): string {
  return PROJECT_TINTS[index % PROJECT_TINTS.length];
}

export function allWorktrees(projects: ProjectWorktreeList[]): WorktreeInfo[] {
  return projects.flatMap((project) => project.worktrees);
}

export function refOf(wt: WorktreeRef): WorktreeRef {
  return { project: wt.project, branch: wt.branch };
}

/** ArrowUp/ArrowDown over the given row keys; returns the new key or null when unhandled. */
export function stepSelection(event: KeyboardEvent, keys: string[], current: string | null): string | null {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return null;
  if (keys.length === 0) return null;
  event.preventDefault();
  const index = current ? keys.indexOf(current) : -1;
  const delta = event.key === "ArrowUp" ? -1 : 1;
  const next = index === -1 ? (delta > 0 ? 0 : keys.length - 1) : Math.min(keys.length - 1, Math.max(0, index + delta));
  return keys[next];
}

export function toggled(set: ReadonlySet<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export { worktreeKey };

export function scrollKeyIntoView(root: HTMLElement | null, key: string): void {
  const row = Array.from(root?.querySelectorAll<HTMLElement>("[data-key]") ?? []).find((el) => el.dataset.key === key);
  row?.scrollIntoView({ block: "nearest" });
}

export type MenuEntry = { label: string; danger?: boolean } | "separator";

export interface MenuTarget {
  x: number;
  y: number;
  title: string;
  items: MenuEntry[];
}

export function worktreeMenu(wt: WorktreeInfo, favorite: boolean): MenuEntry[] {
  return [
    { label: wt.mux === "✓" ? "Close session" : "Open session" },
    { label: favorite ? "Unpin" : "Pin to top" },
    { label: "Rename label…" },
    { label: "Change profile…" },
    { label: "Create sub-worktree" },
    "separator",
    { label: wt.linearIssue ? `Post conversation to ${wt.linearIssue.identifier}` : "Post conversation to Linear…" },
    { label: wt.archived ? "Restore" : "Archive" },
    { label: "Remove…", danger: true },
  ];
}

export function projectMenu(): MenuEntry[] {
  return [
    { label: "New worktree" },
    { label: "Pull main" },
    { label: "Open in VS Code" },
    "separator",
    { label: "Remove project…", danger: true },
  ];
}

export function menuAt(event: MouseEvent, title: string, items: MenuEntry[]): MenuTarget {
  event.preventDefault();
  event.stopPropagation();
  return { x: event.clientX, y: event.clientY, title, items };
}

/** Every variant takes the same data; `selected` is a worktree key the lab's main area mirrors. */
export interface VariantProps {
  projects: ProjectWorktreeList[];
  notified: ReadonlySet<string>;
  favorites: ReadonlySet<string>;
  selected?: string | null;
}

export function searchFilter(worktrees: WorktreeInfo[], query: string): WorktreeInfo[] {
  return worktrees.filter((wt) => matchesWorktreeSearch(wt, query));
}
