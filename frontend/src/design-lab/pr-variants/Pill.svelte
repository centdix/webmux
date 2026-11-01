<script lang="ts">
  import type { VariantProps } from "../lab";
  import { CI_TEXT, PR_STATUS, prRef, prStatusOf, rankedPrs, type LabPr } from "../pr-lab";
  import PrLink from "../components/PrLink.svelte";
  import RailSidebar from "./RailSidebar.svelte";

  let { projects, notified, favorites, selected = $bindable(null) }: VariantProps = $props();
</script>

<RailSidebar {projects} {notified} {favorites} bind:selected>
  {#snippet actions(wt)}
    {@const prs = rankedPrs(wt)}
    {#if prs.length > 0}
      <PrLink {prs} class="mr-1 gap-1">
        {#each prs as pr, i (pr.url)}
          <span class={i > 0 ? "@max-[180px]:hidden" : ""}>{@render pill(pr)}</span>
        {/each}
        {#if prs.length > 1}<span class="hidden text-[10px] text-muted @max-[180px]:inline">+{prs.length - 1}</span>{/if}
      </PrLink>
    {/if}
  {/snippet}
</RailSidebar>

{#snippet pill(pr: LabPr)}
  {@const status = PR_STATUS[prStatusOf(pr)]}
  <span
    class="inline-flex h-[18px] items-center gap-1 rounded-full px-1.5 text-[10.5px] font-medium tabular-nums {status.text} {status.tint} hover:brightness-125"
    data-pr-status={prStatusOf(pr)}
  >
    {#if pr.state === "open" && pr.ciStatus !== "none"}
      <span class="h-1.5 w-1.5 rounded-full bg-current {CI_TEXT[pr.ciStatus]} {pr.ciStatus === 'pending' ? 'animate-pulse' : ''}"></span>
    {/if}
    <span class={pr.state === "closed" ? "line-through" : ""}>{prRef(pr)}</span>
  </span>
{/snippet}
