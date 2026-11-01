<script lang="ts">
  import type { PrIconKind } from "../pr-lab";

  let { kind, size = 12, class: className = "" }: { kind: PrIconKind; size?: number; class?: string } = $props();
</script>

<!-- GitHub-like glyphs drawn on the lab's 16px stroke grid. -->
<svg
  class="shrink-0 {className}"
  width={size}
  height={size}
  viewBox="0 0 16 16"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if kind === "open"}
    <circle cx="4.5" cy="3.5" r="1.5" /><circle cx="4.5" cy="12.5" r="1.5" /><circle cx="11.5" cy="12.5" r="1.5" />
    <path d="M4.5 5v6M11.5 11V6.5c0-1-.5-1.5-1.5-1.5H7.5M9 3.5L7.5 5 9 6.5" />
  {:else if kind === "draft"}
    <circle cx="4.5" cy="3.5" r="1.5" /><circle cx="4.5" cy="12.5" r="1.5" /><circle cx="11.5" cy="12.5" r="1.5" />
    <path d="M4.5 5v6" /><circle cx="11.5" cy="4" r=".6" fill="currentColor" /><circle cx="11.5" cy="8" r=".6" fill="currentColor" />
  {:else if kind === "merged"}
    <circle cx="4.5" cy="3.5" r="1.5" /><circle cx="4.5" cy="12.5" r="1.5" /><circle cx="11.5" cy="8.5" r="1.5" />
    <path d="M4.5 5v6M4.5 5c0 2.5 2 3.5 5.5 3.5" />
  {:else if kind === "closed"}
    <circle cx="4.5" cy="3.5" r="1.5" /><circle cx="4.5" cy="12.5" r="1.5" /><circle cx="11.5" cy="12.5" r="1.5" />
    <path d="M4.5 5v6M11.5 8.5V11M9.8 2.8l3.4 3.4M13.2 2.8L9.8 6.2" />
  {:else if kind === "ci-success"}
    <circle cx="8" cy="8" r="6" /><path d="M5.2 8.2l1.9 1.9 3.7-4" />
  {:else if kind === "ci-failed"}
    <circle cx="8" cy="8" r="6" /><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" />
  {:else if kind === "ci-pending"}
    <circle cx="8" cy="8" r="6" stroke-dasharray="3 2.2" /><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
  {:else if kind === "approved"}
    <path d="M3 8.5l3.2 3.2L13 4.8" stroke-width="1.9" />
  {:else if kind === "changes"}
    <path d="M8 2.5v6M5 5.5h6M5 12.5h6" stroke-width="1.8" />
  {:else if kind === "conflicts"}
    <path d="M8 2.2l6.2 11H1.8z" /><path d="M8 6.5v3" /><circle cx="8" cy="11.4" r=".5" fill="currentColor" />
  {:else}
    <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
  {/if}
</svg>
