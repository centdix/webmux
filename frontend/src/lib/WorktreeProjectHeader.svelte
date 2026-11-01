<script lang="ts">
  import type { Snippet } from "svelte";
  import AgentStatusCount from "./AgentStatusCount.svelte";
  import {
    OVERFLOW_STATUS_BAR_STATUSES,
    OVERFLOW_STATUS_LABELS,
    type OverflowStatusBarStatus,
  } from "./worktree-list";

  let {
    name,
    count,
    collapsed,
    error,
    listId,
    separated,
    statusCounts,
    ontoggle,
    children,
  }: {
    name: string;
    count: number;
    collapsed: boolean;
    error: string | null;
    /** Id of the project's row list, which the header expands and collapses. */
    listId: string;
    /** Draw a separator above (every project but the first). */
    separated: boolean;
    /** The project's agent statuses, shown while collapsed since its rows are hidden. */
    statusCounts: Record<OverflowStatusBarStatus, number>;
    ontoggle: () => void;
    /** Project actions, shown beside the title on hover or focus. */
    children?: Snippet;
  } = $props();

  let shownStatuses = $derived(collapsed ? OVERFLOW_STATUS_BAR_STATUSES.filter((s) => statusCounts[s] > 0) : []);
  let label = $derived(
    [`${name}, ${count} worktrees`, ...shownStatuses.map((s) => `${statusCounts[s]} ${OVERFLOW_STATUS_LABELS[s]}`)].join(", "),
  );
</script>

<div
  class="sticky top-0 z-[1] bg-sidebar px-1 pt-2 pb-1 {separated ? 'border-t border-edge' : ''}"
  data-project-header-bar
>
  <div class="group/header flex items-center gap-0.5 rounded-md hover:bg-hover">
    <button
      type="button"
      class="min-w-0 flex-1 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-base font-bold text-primary bg-transparent cursor-pointer"
      aria-expanded={!collapsed}
      aria-controls={listId}
      aria-label={label}
      data-project-header
      onclick={ontoggle}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
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
      {#each shownStatuses as status (status)}
        <span class="shrink-0 flex items-center gap-1 text-[11px] font-normal tabular-nums" data-project-status={status}>
          <AgentStatusCount {status} count={statusCounts[status]} />
        </span>
      {/each}
      <span class="shrink-0 text-xs font-normal tabular-nums text-muted">{count}</span>
    </button>
    {@render children?.()}
  </div>
</div>
{#if error !== null}
  <p class="truncate px-2.5 pb-1 text-[11px] text-danger" title={error} role="status">
    Failed to load worktrees: {error}
  </p>
{/if}
