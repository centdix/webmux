<script lang="ts">
  import type { PrEntry } from "./types";
  import { PR_STATE_TEXT_CLASS, prStateLabel, prStateOf } from "./worktree-status";

  let { pr }: { pr: PrEntry } = $props();

  let state = $derived(prStateOf(pr));
</script>

<!-- A row's PR, as its state only (see `rowPr`). -->
<span
  class="inline-flex shrink-0 items-center {PR_STATE_TEXT_CLASS[state]}"
  title={prStateLabel(pr)}
  data-pr-state={state}
>
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
    {#if state === "merged"}
      <circle cx="4.5" cy="3.5" r="1.5" /><circle cx="4.5" cy="12.5" r="1.5" /><circle cx="11.5" cy="8.5" r="1.5" />
      <path d="M4.5 5v6M4.5 5c0 2.5 2 3.5 5.5 3.5" />
    {:else}
      <circle cx="4.5" cy="3.5" r="1.5" /><circle cx="4.5" cy="12.5" r="1.5" /><circle cx="11.5" cy="12.5" r="1.5" />
      <path d="M4.5 5v6" />
      {#if state === "draft"}
        <path d="M11.5 4.5v.5M11.5 7.5v.5" />
      {:else if state === "closed"}
        <path d="M10 4l3 3M13 4l-3 3" />
      {:else}
        <path d="M11.5 11V6.5c0-1-.5-1.5-1.5-1.5H8" />
      {/if}
    {/if}
  </svg>
</span>
