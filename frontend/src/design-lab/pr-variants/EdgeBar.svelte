<script lang="ts">
  import type { VariantProps } from "../lab";
  import { PR_STATUS, prRef, prStatusOf, rankedPrs } from "../pr-lab";
  import PrLink from "../components/PrLink.svelte";
  import RailSidebar from "./RailSidebar.svelte";

  let { projects, notified, favorites, selected = $bindable(null) }: VariantProps = $props();
</script>

<RailSidebar {projects} {notified} {favorites} bind:selected>
  {#snippet actions(wt)}
    {@const prs = rankedPrs(wt)}
    {#if prs.length > 0}
      <PrLink {prs} class="mr-1.5 h-7 gap-1.5 pl-1">
        <span class="hidden text-[10.5px] tabular-nums group-hover:inline group-has-[[aria-selected=true]]:inline {PR_STATUS[prStatusOf(prs[0])].text}">{prRef(prs[0])}</span>
        <span class="flex h-4 w-[3px] flex-col gap-px">
          {#each prs as pr (pr.url)}
            <span class="flex-1 rounded-full {PR_STATUS[prStatusOf(pr)].bg} {pr.isDraft || pr.state === 'closed' ? 'opacity-50' : ''}"></span>
          {/each}
        </span>
      </PrLink>
    {/if}
  {/snippet}
</RailSidebar>
