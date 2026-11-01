<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    label,
    collapsed,
    ontoggle,
    oncontextmenu,
    trailing,
    actions,
  }: {
    label: string;
    collapsed: boolean;
    ontoggle: () => void;
    oncontextmenu?: (event: MouseEvent) => void;
    /** Counts/badges right of the label, inside the toggle. */
    trailing?: Snippet;
    /** Buttons revealed on hover/focus. */
    actions?: Snippet;
  } = $props();
</script>

<div class="group/h mt-2 flex h-7 items-center rounded-md pr-1 first:mt-0 hover:bg-hover">
  <button
    type="button"
    class="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1.5 pl-1.5 text-left text-[11px] font-semibold tracking-wide text-muted uppercase"
    aria-expanded={!collapsed}
    onclick={ontoggle}
    {oncontextmenu}
  >
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="shrink-0 opacity-60 transition-transform {collapsed ? '-rotate-90' : ''}"
      aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg
    >
    <span class="min-w-0 truncate">{label}</span>
    {@render trailing?.()}
  </button>
  {#if actions}
    <span class="flex shrink-0 opacity-0 group-hover/h:opacity-100 focus-within:opacity-100">{@render actions()}</span>
  {/if}
</div>
