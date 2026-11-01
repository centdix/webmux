<script lang="ts">
  import type { Snippet } from "svelte";
  import type { WorktreeInfo } from "../../lib/types";
  import Btn from "../../lib/Btn.svelte";
  import { buildWorktreeListRows, overflowStatusOf, sortFavoritesFirst } from "../../lib/worktree-list";
  import {
    attentionOf,
    displayName,
    isRunning,
    menuAt,
    projectMenu,
    scrollKeyIntoView,
    searchFilter,
    stepSelection,
    worktreeKey,
    worktreeMenu,
    type MenuTarget,
    type VariantProps,
  } from "../lab";
  import ContextMenu from "../components/ContextMenu.svelte";
  import IconBtn from "../components/IconBtn.svelte";
  import ProjectAvatar from "../components/ProjectAvatar.svelte";
  import SearchField from "../components/SearchField.svelte";
  import WorktreeLine from "../components/WorktreeLine.svelte";

  // The D sidebar as shipped in `multi-project-project-rail` (ProjectRail +
  // panel header + WorktreeList); each PR treatment fills the row slots.
  let {
    projects,
    notified,
    favorites,
    selected = $bindable(null),
    trailing: trailingSlot,
    actions: actionsSlot,
    below: belowSlot,
    rowClass,
  }: VariantProps & {
    trailing?: Snippet<[WorktreeInfo]>;
    actions?: Snippet<[WorktreeInfo]>;
    below?: Snippet<[WorktreeInfo]>;
    rowClass?: (wt: WorktreeInfo) => string;
  } = $props();

  let current = $state("webmux");
  let query = $state("");
  let showArchived = $state(false);
  let menu = $state<MenuTarget | null>(null);
  let listEl = $state<HTMLElement | null>(null);

  let project = $derived(projects.find((p) => p.prefix === current) ?? projects[0]);
  let rows = $derived(buildWorktreeListRows(sortFavoritesFirst(searchFilter(project.worktrees, query), favorites)));
  let active = $derived(rows.filter((r) => !r.worktree.archived));
  let archived = $derived(rows.filter((r) => r.worktree.archived));
  let shownRows = $derived([...active, ...(showArchived ? archived : [])]);

  function onkeydown(event: KeyboardEvent): void {
    const next = stepSelection(event, shownRows.map((r) => worktreeKey(r.worktree)), selected ?? null);
    if (next) {
      selected = next;
      scrollKeyIntoView(listEl, next);
    }
  }

  function openMenu(event: MouseEvent, wt: WorktreeInfo): void {
    menu = menuAt(event, displayName(wt), worktreeMenu(wt, favorites.has(worktreeKey(wt))));
  }
</script>

<div class="flex h-full min-h-0 bg-sidebar text-primary">
  <nav class="flex w-12 shrink-0 flex-col items-center border-r border-edge bg-surface/40" aria-label="Projects">
    <ul class="flex min-h-0 w-full flex-1 list-none flex-col items-center gap-3 overflow-y-auto py-2.5">
      {#each projects as p, index (p.prefix)}
        {@const needs = p.worktrees.filter((wt) => !wt.archived && overflowStatusOf(wt, notified) !== null).length}
        <li>
          <button
            type="button"
            class="relative flex cursor-pointer items-center justify-center rounded-lg {p.prefix === current ? 'ring-2 ring-accent/70' : 'opacity-75 hover:opacity-100'}"
            title={p.name}
            aria-label={p.name}
            aria-current={p.prefix === current ? "page" : undefined}
            onclick={() => (current = p.prefix)}
          >
            <ProjectAvatar name={p.name} {index} error={p.error !== null} />
            {#if p.error !== null}
              <span class="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-surface ring-2 ring-sidebar">!</span>
            {:else if needs > 0}
              <span class="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[9px] font-bold text-surface tabular-nums ring-2 ring-sidebar">{needs}</span>
            {/if}
            {#if p.worktrees.some((wt) => !wt.archived && isRunning(wt, notified))}
              <span class="absolute -right-1 -bottom-1 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-sidebar"></span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
    <div class="flex shrink-0 flex-col items-center gap-1.5 py-2.5">
      <IconBtn icon="plus" label="Add project" class="h-8 w-8 rounded-lg border border-dashed border-edge" onclick={() => {}} />
      <IconBtn icon="help" label="Keyboard shortcuts" onclick={() => {}} />
      <IconBtn icon="gear" label="Settings" onclick={() => {}} />
    </div>
  </nav>

  <div class="@container flex min-w-0 flex-1 flex-col">
    <div class="flex flex-col gap-2 px-2.5 pt-3 pb-2">
      <div class="flex items-center gap-1">
        <h1 class="min-w-0 flex-1 truncate text-sm font-semibold">{project.name}</h1>
        <IconBtn icon="plus" label="New worktree in {project.name}" onclick={() => {}} />
        <IconBtn icon="more" label="Actions for {project.name}" onclick={(e) => (menu = menuAt(e, project.name, projectMenu()))} />
      </div>
      <SearchField bind:value={query} />
    </div>

    <div
      bind:this={listEl}
      class="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2 focus:outline-none"
      role="listbox"
      tabindex="0"
      aria-label="Worktrees"
      {onkeydown}
    >
      {#if project.error}
        <div class="m-1 mb-2 flex flex-col items-start gap-2 rounded-md border border-danger/30 bg-danger/5 p-2.5 text-[11px]">
          <span class="font-medium text-danger">Couldn't load worktrees</span>
          <span class="font-mono break-all text-muted">{project.error}</span>
          <Btn small>Retry</Btn>
        </div>
      {/if}
      {#each active as row (worktreeKey(row.worktree))}
        {@render line(row.worktree, row.depth)}
      {/each}
      {#if archived.length > 0}
        <button
          type="button"
          class="mt-2 flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-md pl-1.5 text-left text-[11px] font-semibold tracking-wide text-muted uppercase hover:bg-hover"
          aria-expanded={showArchived}
          onclick={() => (showArchived = !showArchived)}
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 opacity-60 transition-transform {showArchived ? '' : '-rotate-90'}" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>
          Archived ({archived.length})
        </button>
        {#if showArchived}
          {#each archived as row (worktreeKey(row.worktree))}
            {@render line(row.worktree, row.depth)}
          {/each}
        {/if}
      {/if}
    </div>
  </div>
</div>

{#if menu}<ContextMenu target={menu} onclose={() => (menu = null)} />{/if}

{#snippet line(wt: WorktreeInfo, depth: number)}
  {@const key = worktreeKey(wt)}
  <WorktreeLine
    {wt}
    {key}
    {depth}
    attention={attentionOf(wt, notified)}
    selected={key === selected}
    favorite={favorites.has(key)}
    class={rowClass?.(wt) ?? ""}
    onselect={() => (selected = key)}
    onmenu={(e) => openMenu(e, wt)}
  >
    {#snippet trailing()}{@render trailingSlot?.(wt)}{/snippet}
    {#snippet actions()}{@render actionsSlot?.(wt)}{/snippet}
    {#snippet below()}{@render belowSlot?.(wt)}{/snippet}
  </WorktreeLine>
{/snippet}
