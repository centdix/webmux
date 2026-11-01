<script lang="ts">
  import { actionablePr, type VariantProps } from "../lab";
  import PrMark from "../components/PrMark.svelte";
  import RailSidebar from "./RailSidebar.svelte";

  let { projects, notified, favorites, selected = $bindable(null) }: VariantProps = $props();
</script>

<RailSidebar {projects} {notified} {favorites} bind:selected>
  {#snippet trailing(wt)}
    {@const pr = actionablePr(wt)}
    {#if pr}<PrMark {pr} showNumber={false} />{/if}
  {/snippet}
</RailSidebar>
