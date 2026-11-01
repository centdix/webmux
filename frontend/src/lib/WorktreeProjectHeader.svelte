<script lang="ts">
  let {
    name,
    count,
    collapsed,
    error,
    ontoggle,
  }: {
    name: string;
    count: number;
    collapsed: boolean;
    error: string | null;
    ontoggle: () => void;
  } = $props();
</script>

<div class="px-1 pt-2 pb-1">
  <button
    type="button"
    class="w-full flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm font-semibold text-primary bg-transparent hover:bg-hover cursor-pointer"
    aria-expanded={!collapsed}
    data-project-header
    onclick={ontoggle}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="shrink-0 text-muted transition-transform {collapsed ? '-rotate-90' : ''}"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
    <span class="min-w-0 flex-1 truncate">{name}</span>
    <span class="shrink-0 text-[11px] font-normal tabular-nums text-muted">{count}</span>
  </button>
  {#if error !== null}
    <p class="truncate px-1.5 text-[11px] text-muted" title={error} role="status">
      Failed to load worktrees: {error}
    </p>
  {/if}
</div>
