<script lang="ts">
  import AgentStatusIcon from "./AgentStatusIcon.svelte";
  import type { Attention } from "./worktree-status";

  let { attention, size = 12 }: { attention: Attention; size?: number } = $props();
</script>

<!-- Fixed-size slot so names align whatever the state. -->
<span
  class="inline-flex shrink-0 items-center justify-center"
  style="width:{size + 4}px;height:{size + 4}px"
  aria-hidden="true"
  data-attention={attention}
>
  {#if attention === "creating"}
    <span class="spinner text-muted" style="width:{size - 2}px;height:{size - 2}px"></span>
  {:else if attention === "closed"}
    <span class="rounded-full border border-muted/60" style="width:{size - 5}px;height:{size - 5}px"></span>
  {:else if attention === "idle"}
    <span class="rounded-full bg-muted/40" style="width:{size - 7}px;height:{size - 7}px"></span>
  {:else}
    <AgentStatusIcon status={attention === "unread" ? "done" : attention} unread={attention === "unread"} {size} />
  {/if}
</span>
