<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    href,
    disabled = false,
    danger = false,
    onclick,
    children,
  }: {
    /** Renders a link instead of a button. */
    href?: string;
    disabled?: boolean;
    danger?: boolean;
    onclick?: () => void;
    children: Snippet;
  } = $props();

  let className = $derived(
    `block w-full px-2 py-1.5 rounded text-left text-xs no-underline hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed ${danger ? "text-danger" : "text-primary"}`,
  );
</script>

{#if href}
  <a {href} class={className} {onclick}>{@render children()}</a>
{:else}
  <button type="button" {disabled} class={className} {onclick}>{@render children()}</button>
{/if}
