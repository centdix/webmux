import type { Component } from "svelte";
import type { VariantProps } from "./lab";
import CalmList from "./variants/CalmList.svelte";
import AttentionInbox from "./variants/AttentionInbox.svelte";
import DenseGrid from "./variants/DenseGrid.svelte";
import ProjectRail from "./variants/ProjectRail.svelte";
import SignalList from "./variants/SignalList.svelte";

export interface VariantMeta {
  id: string;
  name: string;
  component: Component<VariantProps, Record<string, never>, "selected">;
  concept: string;
  glance: string;
  actions: string;
  pros: string;
  cons: string;
}

export const VARIANTS: VariantMeta[] = [
  {
    id: "a",
    name: "Calm list",
    component: CalmList,
    concept: "Today's structure, decluttered: one 28px line per worktree, quiet uppercase project labels, archived folded per project.",
    glance: "One status glyph per row (waiting, error, unread, running, creating, closed, idle) and a PR mark only when it asks for action (CI failed, comments, ready, merged).",
    actions: "Right-click on rows and project labels. A ⋯ shows on the selected row only. Per-project + on hover. Details and Close/Archive/Remove live in the TopBar.",
    pros: "Smallest change from today. Twice the rows fit. Very calm, familiar.",
    cons: "Urgent items can still be scrolled out of view or hidden in collapsed projects. Only a count badge on collapsed headers.",
  },
  {
    id: "b",
    name: "Attention inbox",
    component: AttentionInbox,
    concept: "Sorted by what you have to do, not by where it lives. \"Needs you\" (waiting, error, unread, CI failed, review comments) across all projects, then \"Running\", then everything else per project, collapsed.",
    glance: "Every item needing you, with a one-line reason and its project chip, without scrolling. A running count. Quiet projects stay out of the way.",
    actions: "Right-click or the ⋯ on the selected row. Project + and actions on hover/right-click of the project label.",
    pros: "Answers \"what needs me now?\" in a second, even with 5+ projects. Nothing urgent can hide in a collapsed project.",
    cons: "Rows jump between groups as agents change state. Finding a specific idle worktree takes a click (expand) or search. Less spatial memory.",
  },
  {
    id: "c",
    name: "Dense status grid",
    component: DenseGrid,
    concept: "A table for power users: 22px rows, a 2-letter project chip and fixed right-hand columns for agent, PR, CI and review comments. Sort by project or by status.",
    glance: "Every worktree of every project with all four signals aligned in columns: scan one column top to bottom (e.g. CI).",
    actions: "Right-click only (plus Cmd shortcuts). No hover buttons at all. Archived and settings go in a thin footer.",
    pros: "Highest density (about 30 rows visible), full information, cheap to scan by column. \"Sort: status\" works as a triage mode.",
    cons: "Busy, small targets, column headers are cryptic. Chip initials can clash. The least friendly on mobile/touch.",
  },
  {
    id: "d",
    name: "Project rail + list",
    component: ProjectRail,
    concept: "Slack-style: a 48px rail of project avatars with badges (needs-you count, running dot, load error), and a list of the chosen project (or \"All\").",
    glance: "Rail: which projects need you or are running. List: only one project's worktrees, so rows can stay roomy.",
    actions: "Project actions become visible (+ and ⋯ in the panel header) because the context is explicit. Rows: right-click / ⋯ on selection.",
    pros: "Scales to many projects. Clear project context for \"New worktree\". Error state has room for a real message + Retry.",
    cons: "Costs 48px of width. Cross-project triage needs \"All\" or the badges. Initials avatars are only meaningful after a while.",
  },
  {
    id: "e",
    name: "Signal list",
    component: SignalList,
    concept: "Progressive disclosure: single-line rows that grow a second line only when there is something to say (waiting, CI failed, 2 review comments, ready to merge, creating…). Filter chips with live counts on top.",
    glance: "The reason, not just a glyph: you know what to do before opening the worktree. Chips count Needs you / Running / PRs across projects.",
    actions: "Right-click or ⋯ on the selected row. The selected row reveals its details (agent, profile, ports). Project + on hover.",
    pros: "Explains state in words without clutter (quiet rows stay one line). Chips give B's triage without reordering the list.",
    cons: "Variable row height again (but only where it carries signal). Chips cost a line. Text reasons need careful copy.",
  },
];
