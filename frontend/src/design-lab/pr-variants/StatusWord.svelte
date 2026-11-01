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
    {@const pr = prs[0]}
    {#if pr}
      {@const status = PR_STATUS[prStatusOf(pr)]}
      <PrLink {prs} class="mr-1 gap-1 rounded px-1 text-[11px] whitespace-nowrap tabular-nums hover:bg-hover">
        <span class="text-muted/80 @max-[180px]:hidden">{prRef(pr)}</span>
        <span class="font-medium {status.text}">{status.word}</span>
        {#if prs.length > 1}<span class="text-[10px] text-muted">+{prs.length - 1}</span>{/if}
      </PrLink>
    {/if}
  {/snippet}
</RailSidebar>
