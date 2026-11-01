<script lang="ts">
  import type { PrEntry } from "./types";
  import { PR_SIGNAL_TEXT_CLASS, prSignalLabel, prSignalOf } from "./worktree-status";

  let { pr }: { pr: PrEntry } = $props();

  let signal = $derived(prSignalOf(pr));
</script>

<!-- A row's PR, as the glyph of what it asks of you (see `actionablePr`). -->
<span
  class="inline-flex shrink-0 items-center gap-0.5 text-[11px] tabular-nums {PR_SIGNAL_TEXT_CLASS[signal]}"
  title={prSignalLabel(pr)}
  data-pr-signal={signal}
>
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
    {#if signal === "merged"}
      <circle cx="4.5" cy="3.5" r="1.5" /><circle cx="4.5" cy="12.5" r="1.5" /><circle cx="11.5" cy="8.5" r="1.5" />
      <path d="M4.5 5v6M4.5 5c0 2.5 2 3.5 5.5 3.5" />
    {:else if signal === "ci-failed"}
      <circle cx="8" cy="8" r="6" /><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" />
    {:else if signal === "ready"}
      <circle cx="8" cy="8" r="6" /><path d="M5.2 8.2l1.9 1.9 3.7-4" />
    {:else if signal === "comments"}
      <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" stroke-linejoin="round" />
    {:else if signal === "ci-pending"}
      <circle cx="8" cy="8" r="6" stroke-dasharray="3 2.2" />
    {:else}
      <circle cx="4.5" cy="3.5" r="1.5" /><circle cx="4.5" cy="12.5" r="1.5" /><circle cx="11.5" cy="12.5" r="1.5" />
      <path d="M4.5 5v6M11.5 11V6.5c0-1-.5-1.5-1.5-1.5H8" />
    {/if}
  </svg>
  {#if signal === "comments"}<span>{pr.comments.length}</span>{/if}
</span>
