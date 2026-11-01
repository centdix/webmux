<script lang="ts">
  import type { Snippet } from "svelte";
  import { CI_TEXT, PR_SHAPE_TEXT, PR_STATUS, checksSummary, commentsLabel, prRef, prShapeOf, prStatusOf, prTitle, reviewLabel, type LabPr } from "../pr-lab";
  import PrIcon from "./PrIcon.svelte";

  let {
    prs,
    class: className = "",
    children,
  }: {
    /** The row's PRs, most urgent first: the link opens the first. */
    prs: LabPr[];
    class?: string;
    children: Snippet;
  } = $props();

  /** Beside the mark, growing down, or up when the mark sits low on screen. */
  let card = $state<{ x: number; top?: number; bottom?: number } | null>(null);
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  function show(event: Event): void {
    clearTimeout(hideTimer);
    if (!(event.currentTarget instanceof HTMLElement)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    card =
      rect.top > window.innerHeight * 0.6
        ? { x: rect.right + 10, bottom: Math.max(8, window.innerHeight - rect.bottom - 6) }
        : { x: rect.right + 10, top: Math.max(8, rect.top - 6) };
  }

  function hide(): void {
    hideTimer = setTimeout(() => (card = null), 120);
  }
</script>

<a
  href={prs[0].url}
  target="_blank"
  rel="noopener"
  class="inline-flex shrink-0 cursor-pointer items-center no-underline {className}"
  aria-label={prs.map(prTitle).join(", ")}
  data-pr-link
  onmouseenter={show}
  onmouseleave={hide}
  onfocus={show}
  onblur={hide}>{@render children()}</a
>

{#if card}
  <div
    class="fixed z-50 flex w-64 flex-col gap-2 rounded-lg border border-edge bg-topbar p-2.5 text-[11px] shadow-xl"
    style:left="{card.x}px"
    style:top={card.top === undefined ? null : `${card.top}px`}
    style:bottom={card.bottom === undefined ? null : `${card.bottom}px`}
    role="tooltip"
    data-pr-card
    onmouseenter={() => clearTimeout(hideTimer)}
    onmouseleave={hide}
  >
    {#each prs as pr, i (pr.url)}
      {@const status = PR_STATUS[prStatusOf(pr)]}
      {@const shape = prShapeOf(pr)}
      {#if i > 0}<div class="border-t border-edge"></div>{/if}
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center gap-1.5">
          <PrIcon kind={shape} class={PR_SHAPE_TEXT[shape]} />
          <span class="font-semibold text-primary tabular-nums">{prRef(pr)}</span>
          <span class="font-medium {status.text}">{status.label}</span>
          <a href={pr.url} target="_blank" rel="noopener" class="ml-auto text-muted no-underline hover:text-accent" title="Open on GitHub">↗</a>
        </div>
        <dl class="grid grid-cols-[64px_1fr] gap-x-2 gap-y-0.5">
          <dt class="text-muted">State</dt>
          <dd class="capitalize {PR_SHAPE_TEXT[shape]}">{shape}</dd>
          {#if pr.state === "open"}
            <dt class="text-muted">Checks</dt>
            <dd class={CI_TEXT[pr.ciStatus]}>{checksSummary(pr)}</dd>
            {#each pr.ciChecks.filter((c) => c.status === "failed" || c.status === "pending") as check (check.name)}
              <dt></dt>
              <dd class="text-muted">{check.status === "failed" ? "✕" : "…"} {check.name}</dd>
            {/each}
            {#if !pr.isDraft}<dt class="text-muted">Review</dt>
            <dd class={pr.review === "approved" ? "text-success" : pr.review === "changes_requested" ? "text-warning" : "text-primary"}>
              {reviewLabel(pr)}<span class="text-muted/70"> †</span>
            </dd>{/if}
            <dt class="text-muted">Merge</dt>
            <dd class={pr.mergeable === "conflicting" ? "text-danger" : "text-primary"}>
              {pr.mergeable === "conflicting" ? "Conflicts with base" : "No conflicts"}<span class="text-muted/70"> †</span>
            </dd>
          {/if}
          <dt class="text-muted">Comments</dt>
          <dd class="text-primary">{commentsLabel(pr)}</dd>
        </dl>
      </div>
    {/each}
    <p class="text-[10px] text-muted/70">Click opens {prRef(prs[0])} on GitHub · † needs backend</p>
  </div>
{/if}
