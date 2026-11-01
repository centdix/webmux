<script lang="ts">
  import type { VariantProps } from "../lab";
  import { CHECK_BG, PR_SHAPE_TEXT, PR_STATUS, PR_STATUS_ICON, prRef, prShapeOf, prStatusOf, rankedPrs } from "../pr-lab";
  import PrIcon from "../components/PrIcon.svelte";
  import PrLink from "../components/PrLink.svelte";
  import RailSidebar from "./RailSidebar.svelte";

  let { projects, notified, favorites, selected = $bindable(null) }: VariantProps = $props();
</script>

<RailSidebar {projects} {notified} {favorites} bind:selected>
  {#snippet actions(wt)}
    {@const prs = rankedPrs(wt)}
    {@const pr = prs[0]}
    {#if pr}
      {@const status = prStatusOf(pr)}
      {@const flagged = status === "conflicts" || status === "changes" || status === "ready"}
      <PrLink {prs} class="mr-1 gap-0.5 rounded px-1 text-[10.5px] tabular-nums hover:bg-hover {PR_STATUS[status].text}">
        {#if flagged}<PrIcon kind={PR_STATUS_ICON[status]} size={11} />{/if}
        <span class={flagged ? "@max-[180px]:hidden" : ""}>{prRef(pr)}</span>
      </PrLink>
    {/if}
  {/snippet}
  {#snippet below(wt)}
    {@const prs = rankedPrs(wt)}
    {#if prs.length > 0}
      <PrLink {prs} class="-mt-1 h-1.5 w-full gap-1.5 flex!">
        {#each prs as pr (pr.url)}
          {@const shape = prShapeOf(pr)}
          <span class="flex h-[3px] flex-1 gap-px overflow-hidden rounded-full {pr.isDraft ? 'opacity-50' : ''}">
            {#if pr.state !== "open" || pr.ciChecks.length === 0}
              <span class="flex-1 bg-current opacity-50 {PR_SHAPE_TEXT[shape]}"></span>
            {:else}
              {#each pr.ciChecks as check (check.name)}
                <span class="flex-1 {CHECK_BG[check.status]} {check.status === 'pending' ? 'animate-pulse' : ''}"></span>
              {/each}
            {/if}
          </span>
        {/each}
      </PrLink>
    {/if}
  {/snippet}
</RailSidebar>
