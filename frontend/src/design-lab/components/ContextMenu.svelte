<script lang="ts">
  import { dismissible } from "../../lib/dismissible";
  import MenuItem from "../../lib/MenuItem.svelte";
  import type { MenuTarget } from "../lab";

  let { target, onclose }: { target: MenuTarget; onclose: () => void } = $props();
</script>

<div
  class="fixed z-50 min-w-44 max-w-64 rounded-md border border-edge bg-surface p-1 shadow-lg"
  style="left:{target.x}px;top:{target.y}px"
  role="menu"
  {@attach dismissible(onclose)}
>
  <p class="truncate px-2 pt-1 pb-1.5 text-[10px] text-muted">{target.title}</p>
  {#each target.items as item, i (i)}
    {#if item === "separator"}
      <div class="my-1 border-t border-edge"></div>
    {:else}
      <MenuItem danger={item.danger} onclick={onclose}>{item.label}</MenuItem>
    {/if}
  {/each}
</div>
