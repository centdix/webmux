<script lang="ts">
  import type { WorktreeInfo } from "../../lib/types";
  import { buildWorktreeListRows, sortFavoritesFirst } from "../../lib/worktree-list";
  import {
    attentionOf,
    displayName,
    isRunning,
    menuAt,
    needsYou,
    primaryPr,
    projectMenu,
    reasonOf,
    scrollKeyIntoView,
    searchFilter,
    stepSelection,
    toggled,
    worktreeKey,
    worktreeMenu,
    type MenuTarget,
    type VariantProps,
  } from "../lab";
  import ContextMenu from "../components/ContextMenu.svelte";
  import SearchField from "../components/SearchField.svelte";
  import IconBtn from "../components/IconBtn.svelte";
  import SidebarFooter from "../components/SidebarFooter.svelte";
  import SectionLabel from "../components/SectionLabel.svelte";
  import WorktreeLine from "../components/WorktreeLine.svelte";

  let { projects, notified, favorites, selected = $bindable(null) }: VariantProps = $props();

  // "all" is the resting state; clicking the active chip returns to it.
  type Filter = "all" | "needs" | "running" | "prs" | "archived";

  const FILTERS: { id: Filter; label: string; tone: string; test: (wt: WorktreeInfo) => boolean }[] = [
    { id: "needs", label: "Needs you", tone: "text-warning", test: (wt) => !wt.archived && needsYou(wt, notified) },
    { id: "running", label: "Running", tone: "text-success", test: (wt) => !wt.archived && isRunning(wt, notified) },
    { id: "prs", label: "PRs", tone: "text-accent", test: (wt) => !wt.archived && primaryPr(wt)?.state === "open" },
    { id: "archived", label: "Archived", tone: "text-muted", test: (wt) => wt.archived },
  ];

  let filter = $state<Filter>("all");
  let query = $state("");
  let collapsed = $state<Set<string>>(new Set());
  let menu = $state<MenuTarget | null>(null);
  let listEl = $state<HTMLElement | null>(null);

  let everything = $derived(projects.flatMap((p) => p.worktrees));
  let test = $derived(FILTERS.find((f) => f.id === filter)?.test ?? ((wt: WorktreeInfo) => !wt.archived));
  let sections = $derived(
    projects
      .map((p) => ({
        project: p,
        rows: buildWorktreeListRows(sortFavoritesFirst(searchFilter(p.worktrees, query).filter(test), favorites)),
      }))
      .filter((s) => s.rows.length > 0 || (s.project.error !== null && filter === "all")),
  );
  let visibleKeys = $derived(
    sections.flatMap((s) => (collapsed.has(s.project.prefix) ? [] : s.rows.map((r) => worktreeKey(r.worktree)))),
  );

  function onkeydown(event: KeyboardEvent): void {
    const next = stepSelection(event, visibleKeys, selected ?? null);
    if (next) {
      selected = next;
      scrollKeyIntoView(listEl, next);
    }
  }

  function openMenu(event: MouseEvent, wt: WorktreeInfo): void {
    menu = menuAt(event, displayName(wt), worktreeMenu(wt, favorites.has(worktreeKey(wt))));
  }
</script>

<div class="flex h-full min-h-0 flex-col bg-sidebar text-primary">
  <div class="flex flex-col gap-2 border-b border-edge px-3 pt-3 pb-2.5">
    <div class="flex items-center justify-between">
      <span class="text-sm font-semibold">webmux</span>
      <IconBtn icon="plus" label="New worktree (Cmd+K)" onclick={() => {}} />
    </div>
    <SearchField bind:value={query} />
    <div class="flex flex-wrap gap-1" role="tablist" aria-label="Filter worktrees">
      {#each FILTERS as f (f.id)}
        {@const count = everything.filter(f.test).length}
        {@const isOn = filter === f.id}
        <button
          type="button"
          role="tab"
          aria-selected={isOn}
          class="flex h-6 cursor-pointer items-center gap-1 rounded-full border px-2 text-[11px] whitespace-nowrap {isOn
            ? 'border-accent/60 bg-active text-primary'
            : 'border-edge text-muted hover:text-primary'}"
          onclick={() => (filter = isOn ? "all" : f.id)}
        >
          {f.label}
          <span class="tabular-nums {count > 0 ? f.tone : ''}">{count}</span>
        </button>
      {/each}
    </div>
  </div>

  <div
    bind:this={listEl}
    class="min-h-0 flex-1 overflow-y-auto px-1.5 pt-1 pb-2 focus:outline-none"
    role="listbox"
    tabindex="0"
    aria-label="Worktrees"
    {onkeydown}
  >
    {#each sections as { project, rows } (project.prefix)}
      <SectionLabel
        label={project.name}
        collapsed={collapsed.has(project.prefix)}
        ontoggle={() => (collapsed = toggled(collapsed, project.prefix))}
        oncontextmenu={(e) => (menu = menuAt(e, project.name, projectMenu()))}
      >
        {#snippet trailing()}
          {#if collapsed.has(project.prefix)}<span class="ml-auto font-normal tabular-nums">{rows.length}</span>{/if}
        {/snippet}
        {#snippet actions()}
          <IconBtn icon="plus" label="New worktree in {project.name}" onclick={() => {}} />
        {/snippet}
      </SectionLabel>
      {#if !collapsed.has(project.prefix)}
        {#if project.error}
          <div class="flex items-center gap-2 px-2 pb-1 text-[11px]">
            <span class="min-w-0 flex-1 truncate text-danger" title={project.error}>Couldn't load worktrees</span>
            <button type="button" class="shrink-0 cursor-pointer text-muted underline-offset-2 hover:text-primary hover:underline">Retry</button>
          </div>
        {/if}
        {#each rows as { worktree: wt, depth } (worktreeKey(wt))}
          {@render signalRow(wt, depth)}
        {/each}
      {/if}
    {/each}
    {#if sections.length === 0}
      <p class="px-3 py-6 text-center text-xs text-muted">Nothing here. Nice.</p>
    {/if}
  </div>

  <SidebarFooter />
</div>

{#if menu}<ContextMenu target={menu} onclose={() => (menu = null)} />{/if}

{#snippet signalRow(wt: WorktreeInfo, depth: number)}
  {@const key = worktreeKey(wt)}
  {@const isSelected = key === selected}
  {@const attention = attentionOf(wt, notified)}
  {@const reason = reasonOf(wt, notified)}
  <WorktreeLine
    {wt}
    {key}
    {depth}
    {attention}
    selected={isSelected}
    favorite={favorites.has(key)}
    onselect={() => (selected = key)}
    onmenu={(e) => openMenu(e, wt)}
  >
    {#snippet trailing()}
      {#if attention === "working"}<span class="shrink-0 text-[10px] text-muted tabular-nums">{wt.elapsed}</span>{/if}
    {/snippet}
    {#snippet below()}
      {#if reason}
        <span class="block truncate text-[11px] leading-4 {reason.tone}">{reason.text}</span>
      {/if}
      {#if isSelected}
        <span class="mt-0.5 block truncate text-[11px] leading-4 text-muted">
          {[wt.agentLabel, wt.profile, wt.dirty ? "dirty" : null, ...wt.services.filter((s) => s.port).map((s) => `${s.name}:${s.port}`)]
            .filter(Boolean)
            .join(" · ")}
        </span>
      {/if}
    {/snippet}
  </WorktreeLine>
{/snippet}
