import type { Component } from "svelte";
import type { VariantProps } from "./lab";
import Baseline from "./pr-variants/Baseline.svelte";
import Pill from "./pr-variants/Pill.svelte";
import IconPair from "./pr-variants/IconPair.svelte";
import StatusWord from "./pr-variants/StatusWord.svelte";
import MetaLine from "./pr-variants/MetaLine.svelte";
import CheckStrip from "./pr-variants/CheckStrip.svelte";
import EdgeBar from "./pr-variants/EdgeBar.svelte";

export interface PrVariantMeta {
  id: string;
  name: string;
  component: Component<VariantProps, Record<string, never>, "selected">;
  glance: string;
  narrow: string;
  pros: string;
  cons: string;
}

export const PR_VARIANTS: PrVariantMeta[] = [
  {
    id: "0",
    name: "Today (D as shipped)",
    component: Baseline,
    glance: "A PR glyph only when it asks for action: CI failed, N comments, ready, merged. Drafts, CI running, review and closed PRs show nothing.",
    narrow: "Unchanged: one 12px glyph.",
    pros: "Quietest. Only actionable PRs make noise.",
    cons: "You can't tell \"no PR\" from \"PR waiting for review\". The comment count is the loudest PR signal, though comments are often resolved.",
  },
  {
    id: "1",
    name: "State pill",
    component: Pill,
    glance: "Every PR gets a pill \"#38\", tinted by where it stands (red: conflicts/CI failed, amber: changes requested, green: ready, blue: awaiting review, grey: draft/CI running/closed, violet: merged). Inside, a dot for CI.",
    narrow: "The number keeps its slot. The name loses ~45px. A second PR collapses to \"+1\" under 180px.",
    pros: "The PR number is visible (you speak in PR numbers). Two signals, colour + CI dot, in one target that is easy to hover/click. Closest to GitHub's look.",
    cons: "The widest treatment: takes name width on every PR row. Pill colours next to agent glyphs of the same hues (amber waiting, red error) add up on busy rows.",
  },
  {
    id: "2",
    name: "Icon pair",
    component: IconPair,
    glance: "A fixed 34px column: GitHub's PR icon in its git colour (open green, draft grey, merged violet, closed red) + what blocks the merge (⚠ conflicts, ✕ CI, ± changes, ✓ approved, dashed ring CI running). A count badge when a row has 2 PRs.",
    narrow: "Unchanged: it is already compact. Only the edge bar (6) leaves names more room.",
    pros: "Aligned column, cheap to scan top to bottom. Shapes don't clash with agent glyphs (git icons vs dots/rings). Reads like GitHub.",
    cons: "Two small icons to learn. No PR number without hovering. Approved ✓ vs CI ✓ differ only by the ring.",
  },
  {
    id: "3",
    name: "Status word",
    component: StatusWord,
    glance: "A right-aligned word: \"#38 CI failed\", \"Changes\", \"Ready\", \"Conflicts\", \"Review\", \"Draft\", \"Merged\". The number is dimmed, the word is coloured.",
    narrow: "The number drops under 180px, the word stays. Names get short (\"fix-term…\").",
    pros: "No legend to learn: the most explicit at a glance. Works for colour-blind users.",
    cons: "Text competes with the worktree name, and right-aligned words make a ragged column. \"CI…\" and \"Review\" are a bit cryptic as single words.",
  },
  {
    id: "4",
    name: "Second line",
    component: MetaLine,
    glance: "Rows with a PR grow a quiet 11px line under the name: icon, number, full status, comments (\"#38 CI failed\" + a 2-comment bubble). Both PRs of a linked repo fit on that line (\"#42 Awaiting review  site#12 Draft\").",
    narrow: "The name keeps the full width. The line truncates, the comment count drops under 180px.",
    pros: "The name is never shortened. Room for the full sentence and both PRs. Agent glyph and PR status sit on different lines, so they never blur.",
    cons: "PR rows are 44px instead of 28: half as many rows per screen when most worktrees have PRs. Uneven list rhythm.",
  },
  {
    id: "5",
    name: "Check strip",
    component: CheckStrip,
    glance: "A 3px bar under the name, one segment per CI check (green/red/pulsing amber), solid violet or grey once merged/closed. Right: the PR number in its status colour, with ✓/±/⚠ for approved, changes and conflicts.",
    narrow: "The strip scales with the row. The number hides behind the icon when there is one.",
    pros: "Shows CI progress (3 of 5 checks done), not just pass/fail. Strips line up like a build board. Two PRs = two strips side by side.",
    cons: "Adds ~6px per PR row. Review/merge state rides on a small icon. A 3px line is easy to miss for colour-blind users.",
  },
  {
    id: "6",
    name: "Edge bar",
    component: EdgeBar,
    glance: "A 3px vertical bar at the row's right edge, in the status colour (dimmed for draft/closed). The number shows on hover or for the selected row. Two PRs = a split bar.",
    narrow: "Costs 8px: the best name width with a PR.",
    pros: "Lowest noise of the always-on options: the list reads like today, the right edge reads like a status column.",
    cons: "Colour only, no shape: you have to hover to learn \"amber = changes requested\". Easy to confuse with selection or scroll markers.",
  },
];
