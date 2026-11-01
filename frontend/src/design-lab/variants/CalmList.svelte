<script lang="ts">
  import type { WorktreeInfo } from "../../lib/types";
  import { buildWorktreeListSections } from "../../lib/worktree-list";
  import {
    attentionOf,
    displayName,
    menuAt,
    needsYou,
    actionablePr,
    projectMenu,
    scrollKeyIntoView,
    stepSelection,
    toggled,
    worktreeKey,
    worktreeMenu,
    type MenuTarget,
    type VariantProps,
  } from "../lab";
  import PrMark from "../components/PrMark.svelte";
  import ContextMenu from "../components/ContextMenu.svelte";
  import SearchField from "../components/SearchField.svelte";
  import IconBtn from "../components/IconBtn.svelte";
  import SidebarFooter from "../components/SidebarFooter.svelte";
  import SectionLabel from "../components/SectionLabel.svelte";
  import WorktreeLine from "../components/WorktreeLine.svelte";

  let { projects, notified, favorites, selected = $bindable(null) }: VariantProps = $props();

  let query = $state("");
  let collapsed = $state<Set<string>>(new Set());
  let showArchivedIn = $state<Set<string>>(new Set());
  let menu = $state<MenuTarget | null>(null);
  let listEl = $state<HTMLElement | null>(null);

  let sections = $derived(
    buildWorktreeListSections(projects, { query, showArchived: true, favorites, collapsed }),
  );
  let visibleKeys = $derived(
    sections.flatMap((s) =>
      s.collapsed
        ? []
        : s.rows
            .filter((r) => !r.worktree.archived || showArchivedIn.has(s.prefix))
            .map((r) => worktreeKey(r.worktree)),
    ),
  );

  function onkeydown(event: KeyboardEvent): void {
    const next = stepSelection(event, visibleKeys, selected ?? null);
    if (next) {
      selected = next;
      scrollKeyIntoView(listEl, next);
    }
  }
</script>

<div class="flex h-full min-h-0 flex-col bg-sidebar text-primary">
  <div class="flex flex-col gap-2 px-3 pt-3 pb-2">
    <div class="flex items-center justify-between">
      <span class="text-sm font-semibold">webmux</span>
      <IconBtn icon="plus" label="New worktree (Cmd+K)" onclick={() => {}} />
    </div>
    <SearchField bind:value={query} hint="/" />
  </div>

  <div
    bind:this={listEl}
    class="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2 focus:outline-none"
    role="listbox"
    tabindex="0"
    aria-label="Worktrees"
    {onkeydown}
  >
    {#each sections as section (section.prefix)}
      {@const active = section.rows.filter((r) => !r.worktree.archived)}
      {@const archived = section.rows.filter((r) => r.worktree.archived)}
      {@const attention = active.filter((r) => needsYou(r.worktree, notified)).length}
      <SectionLabel
        label={section.name}
        collapsed={section.collapsed}
        ontoggle={() => (collapsed = toggled(collapsed, section.prefix))}
        oncontextmenu={(e) => (menu = menuAt(e, section.name, projectMenu()))}
      >
        {#snippet trailing()}
          {#if section.error}<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" title={section.error}></span>{/if}
          {#if section.collapsed && attention > 0}
            <span class="shrink-0 rounded-full bg-warning/20 px-1.5 text-[10px] leading-4 font-medium text-warning">{attention}</span>
          {/if}
          {#if section.collapsed}<span class="ml-auto shrink-0 font-normal tabular-nums">{active.length}</span>{/if}
        {/snippet}
        {#snippet actions()}
          <IconBtn icon="plus" label="New worktree in {section.name}" onclick={() => {}} />
        {/snippet}
      </SectionLabel>
      {#if !section.collapsed}
        {#if section.error}
          <p class="truncate px-2 pb-1 text-[11px] text-danger" title={section.error}>Couldn't load worktrees</p>
        {:else if active.length === 0}
          <p class="px-2 pb-1 text-[11px] text-muted">No worktrees</p>
        {/if}
        {#each active as row (worktreeKey(row.worktree))}
          {@render line(row.worktree, row.depth)}
        {/each}
        {#if archived.length > 0}
          <button
            type="button"
            class="flex h-6 w-full cursor-pointer items-center rounded-md pl-7 text-left text-[11px] text-muted hover:text-primary"
            onclick={() => (showArchivedIn = toggled(showArchivedIn, section.prefix))}
          >
            {showArchivedIn.has(section.prefix) ? "Hide" : "Show"} archived ({archived.length})
          </button>
          {#if showArchivedIn.has(section.prefix)}
            {#each archived as row (worktreeKey(row.worktree))}
              {@render line(row.worktree, row.depth)}
            {/each}
          {/if}
        {/if}
      {/if}
    {/each}
    {#if sections.length === 0}
      <p class="px-3 py-4 text-center text-xs text-muted">No match</p>
    {/if}
  </div>

  <SidebarFooter />
</div>

{#if menu}<ContextMenu target={menu} onclose={() => (menu = null)} />{/if}

{#snippet line(wt: WorktreeInfo, depth: number)}
  {@const key = worktreeKey(wt)}
  {@const pr = actionablePr(wt)}
  <WorktreeLine
    {wt}
    {key}
    {depth}
    attention={attentionOf(wt, notified)}
    selected={key === selected}
    favorite={favorites.has(key)}
    onselect={() => (selected = key)}
    onmenu={(e) => (menu = menuAt(e, displayName(wt), worktreeMenu(wt, favorites.has(key))))}
  >
    {#snippet trailing()}
      {#if pr}<PrMark {pr} showNumber={false} />{/if}
    {/snippet}
  </WorktreeLine>
{/snippet}
