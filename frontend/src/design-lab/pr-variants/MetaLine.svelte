<script lang="ts">
  import type { VariantProps } from "../lab";
  import { PR_SHAPE_TEXT, PR_STATUS, prRef, prShapeOf, prStatusOf, rankedPrs } from "../pr-lab";
  import PrIcon from "../components/PrIcon.svelte";
  import PrLink from "../components/PrLink.svelte";
  import RailSidebar from "./RailSidebar.svelte";

  let { projects, notified, favorites, selected = $bindable(null) }: VariantProps = $props();
</script>

<RailSidebar {projects} {notified} {favorites} bind:selected>
  {#snippet below(wt)}
    {@const prs = rankedPrs(wt)}
    {#if prs.length > 0}
      <PrLink {prs} class="-mt-1 max-w-full gap-2 overflow-hidden text-[11px] leading-4 whitespace-nowrap tabular-nums hover:underline">
        {#each prs as pr (pr.url)}
          {@const status = PR_STATUS[prStatusOf(pr)]}
          {@const shape = prShapeOf(pr)}
          <span class="inline-flex min-w-0 items-center gap-1">
            <PrIcon kind={shape} size={10} class={PR_SHAPE_TEXT[shape]} />
            <span class="text-muted">{prRef(pr)}</span>
            <span class="truncate {status.text}">{status.label}</span>
            {#if pr.comments.length > 0 && pr.state === "open"}
              <span class="inline-flex items-center gap-0.5 text-muted @max-[180px]:hidden">
                <PrIcon kind="comment" size={10} />{pr.comments.length}
              </span>
            {/if}
          </span>
        {/each}
      </PrLink>
    {/if}
  {/snippet}
</RailSidebar>
