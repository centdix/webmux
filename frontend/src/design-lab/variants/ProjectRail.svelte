<script lang="ts">
  import type { ProjectWorktreeList, WorktreeInfo } from "../../lib/types";
  import Btn from "../../lib/Btn.svelte";
  import { buildWorktreeListRows, sortFavoritesFirst } from "../../lib/worktree-list";
  import {
    attentionOf,
    displayName,
    isRunning,
    menuAt,
    needsYou,
    actionablePr,
    projectMenu,
    scrollKeyIntoView,
    searchFilter,
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
  import SectionLabel from "../components/SectionLabel.svelte";
  import WorktreeLine from "../components/WorktreeLine.svelte";
  import ProjectAvatar from "../components/ProjectAvatar.svelte";

  let { projects, notified, favorites, selected = $bindable(null) }: VariantProps = $props();

  let current = $state<string>("webmux"); // project prefix, or "all"
  let query = $state("");
  let collapsed = $state<Set<string>>(new Set());
  let showArchived = $state(false);
  let menu = $state<MenuTarget | null>(null);
  let listEl = $state<HTMLElement | null>(null);

  let shown = $derived(current === "all" ? projects : projects.filter((p) => p.prefix === current));
  let sections = $derived(
    shown.map((p) => {
      const rows = buildWorktreeListRows(sortFavoritesFirst(searchFilter(p.worktrees, query), favorites));
      return {
        project: p,
        active: rows.filter((r) => !r.worktree.archived),
        archived: rows.filter((r) => r.worktree.archived),
      };
    }),
  );
  let visibleKeys = $derived(
    sections.flatMap((s) =>
      collapsed.has(s.project.prefix) ? [] : [...s.active, ...(showArchived ? s.archived : [])].map((r) => worktreeKey(r.worktree)),
    ),
  );
  let currentProject = $derived(projects.find((p) => p.prefix === current) ?? null);

  function needsCount(p: ProjectWorktreeList): number {
    return p.worktrees.filter((wt) => !wt.archived && needsYou(wt, notified)).length;
  }

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

<div class="flex h-full min-h-0 bg-sidebar text-primary">
  <!-- Rail -->
  <nav class="flex w-12 shrink-0 flex-col items-center gap-3 border-r border-edge bg-surface/40 py-2.5" aria-label="Projects">
    {@render railItem("all", "All projects", projects.reduce((n, p) => n + needsCount(p), 0), false, false)}
    <span class="h-px w-6 bg-edge"></span>
    {#each projects as project, index (project.prefix)}
      {@render railItem(
        project.prefix,
        project.name,
        needsCount(project),
        project.worktrees.some((wt) => isRunning(wt, notified)),
        project.error !== null,
        index,
      )}
    {/each}
    <span class="mt-auto"></span>
    <IconBtn icon="plus" label="Add project" class="h-8 w-8 rounded-lg border border-dashed border-edge" onclick={() => {}} />
    <IconBtn icon="gear" label="Settings" onclick={() => {}} />
  </nav>

  <!-- Panel -->
  <div class="flex min-w-0 flex-1 flex-col">
    <div class="flex flex-col gap-2 px-2.5 pt-3 pb-2">
      <div class="flex items-center gap-1">
        <span class="min-w-0 flex-1 truncate text-sm font-semibold">{currentProject?.name ?? "All projects"}</span>
        <IconBtn icon="plus" label="New worktree" onclick={() => {}} />
        {#if currentProject}
          {@const name = currentProject.name}
          <IconBtn icon="more" label="Project actions" onclick={(e) => (menu = menuAt(e, name, projectMenu()))} />
        {/if}
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
      {#each sections as { project, active, archived } (project.prefix)}
        {#if current === "all"}
          <SectionLabel
            label={project.name}
            collapsed={collapsed.has(project.prefix)}
            ontoggle={() => (collapsed = toggled(collapsed, project.prefix))}
            oncontextmenu={(e) => (menu = menuAt(e, project.name, projectMenu()))}
          >
            {#snippet trailing()}
              {#if project.error}<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-danger"></span>{/if}
            {/snippet}
          </SectionLabel>
        {/if}
        {#if !collapsed.has(project.prefix)}
          {#if project.error}
            <div class="m-1 flex flex-col items-start gap-2 rounded-md border border-danger/30 bg-danger/5 p-2.5 text-[11px]">
              <span class="font-medium text-danger">Couldn't load worktrees</span>
              <span class="font-mono break-all text-muted">{project.error}</span>
              <Btn small>Retry</Btn>
            </div>
          {/if}
          {#each [...active, ...(showArchived ? archived : [])] as { worktree: wt, depth } (worktreeKey(wt))}
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
              onmenu={(e) => openMenu(e, wt)}
            >
              {#snippet trailing()}
                {#if pr}<PrMark {pr} showNumber={false} />{/if}
              {/snippet}
            </WorktreeLine>
          {/each}
        {/if}
      {/each}
    </div>

    <div class="shrink-0 border-t border-edge px-2.5 py-1.5">
      <button type="button" class="cursor-pointer text-[11px] text-muted hover:text-primary" onclick={() => (showArchived = !showArchived)}>
        {showArchived ? "Hide" : "Show"} archived ({sections.reduce((n, s) => n + s.archived.length, 0)})
      </button>
    </div>
  </div>
</div>

{#if menu}<ContextMenu target={menu} onclose={() => (menu = null)} />{/if}

{#snippet railItem(id: string, name: string, needs: number, running: boolean, error: boolean, index = 0)}
  {@const isCurrent = current === id}
  <button
    type="button"
    class="relative flex cursor-pointer items-center justify-center rounded-lg {isCurrent ? 'ring-2 ring-accent/70' : 'opacity-75 hover:opacity-100'}"
    title="{name}{needs ? ` · ${needs} need you` : ''}{error ? ' · failed to load' : ''}"
    aria-label={name}
    aria-current={isCurrent}
    onclick={() => (current = id)}
    oncontextmenu={id === "all" ? undefined : (e) => (menu = menuAt(e, name, projectMenu()))}
  >
    {#if id === "all"}
      <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-hover text-muted">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"
          ><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg
        >
      </span>
    {:else}
      <ProjectAvatar {name} {index} {error} />
    {/if}
    {#if error}
      <span class="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-surface ring-2 ring-sidebar">!</span>
    {:else if needs > 0}
      <span class="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[9px] font-bold text-surface tabular-nums ring-2 ring-sidebar">{needs}</span>
    {/if}
    {#if running}
      <span class="absolute -right-1 -bottom-1 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-sidebar" title="Agents running"></span>
    {/if}
  </button>
{/snippet}
