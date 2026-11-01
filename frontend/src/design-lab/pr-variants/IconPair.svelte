<script lang="ts">
  import type { VariantProps } from "../lab";
  import { PR_SHAPE_TEXT, prShapeOf, prStatusOf, rankedPrs, type PrIconKind, type PrStatus } from "../pr-lab";
  import PrIcon from "../components/PrIcon.svelte";
  import PrLink from "../components/PrLink.svelte";
  import RailSidebar from "./RailSidebar.svelte";

  let { projects, notified, favorites, selected = $bindable(null) }: VariantProps = $props();

  /** The second icon: what stands between the PR and a merge. */
  const NEXT: Partial<Record<PrStatus, [PrIconKind, string]>> = {
    conflicts: ["conflicts", "text-danger"],
    "ci-failed": ["ci-failed", "text-danger"],
    changes: ["changes", "text-warning"],
    ready: ["approved", "text-success"],
    "ci-pending": ["ci-pending", "text-muted"],
    review: ["ci-success", "text-success/60"],
    draft: ["ci-pending", "text-muted"],
  };
</script>

<RailSidebar {projects} {notified} {favorites} bind:selected>
  {#snippet actions(wt)}
    {@const prs = rankedPrs(wt)}
    {@const pr = prs[0]}
    {#if pr}
      {@const shape = prShapeOf(pr)}
      {@const status = prStatusOf(pr)}
      {@const next = status === "draft" && pr.ciStatus !== "pending" ? undefined : NEXT[status]}
      {@const showNext = next && !(status === "review" && pr.ciStatus === "none")}
      <PrLink {prs} class="relative mr-1 h-5 w-[34px] justify-end gap-1 rounded px-0.5 hover:bg-hover">
        <PrIcon kind={shape} class={PR_SHAPE_TEXT[shape]} />
        {#if showNext && next}<PrIcon kind={next[0]} class={next[1]} />{:else}<span class="w-3"></span>{/if}
        {#if prs.length > 1}
          <span class="absolute -top-1 -left-1 flex h-3 min-w-3 items-center justify-center rounded-full bg-hover px-0.5 text-[8px] font-bold text-primary ring-1 ring-edge">{prs.length}</span>
        {/if}
      </PrLink>
    {/if}
  {/snippet}
</RailSidebar>
