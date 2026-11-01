<script lang="ts">
  import type { WorktreeInfo } from "../../lib/types";
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
    type Attention,
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
  import ProjectAvatar from "../components/ProjectAvatar.svelte";

  let { projects, notified, favorites, selected = $bindable(null) }: VariantProps = $props();

  const URGENCY: Attention[] = ["waiting", "error", "unread", "working", "idle", "closed", "creating"];

  let query = $state("");
  // Projects start collapsed: the top groups already surface what matters.
  let expanded = $state<Set<string>>(new Set());
  let collapsedGroups = $state<Set<string>>(new Set());
  let menu = $state<MenuTarget | null>(null);
  let listEl = $state<HTMLElement | null>(null);

  let projectIndex = $derived(new Map(projects.map((p, i) => [p.prefix, i])));
  let live = $derived(searchFilter(projects.flatMap((p) => p.worktrees), query).filter((wt) => !wt.archived));
  let inbox = $derived(
    live
      .filter((wt) => needsYou(wt, notified))
      .sort((a, b) => URGENCY.indexOf(attentionOf(a, notified)) - URGENCY.indexOf(attentionOf(b, notified))),
  );
  let failedProjects = $derived(projects.filter((p) => p.error !== null));
  let running = $derived(live.filter((wt) => !needsYou(wt, notified) && isRunning(wt, notified)));
  let surfaced = $derived(new Set([...inbox, ...running].map(worktreeKey)));
  let rest = $derived(
    projects.map((p) => ({
      project: p,
      rows: searchFilter(p.worktrees, query).filter((wt) => !surfaced.has(worktreeKey(wt))),
    })),
  );

  let visibleKeys = $derived([
    ...(collapsedGroups.has("inbox") ? [] : inbox.map(worktreeKey)),
    ...(collapsedGroups.has("running") ? [] : running.map(worktreeKey)),
    ...rest.flatMap((r) => (expanded.has(r.project.prefix) ? r.rows.map(worktreeKey) : [])),
  ]);

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
  <div class="flex flex-col gap-2 px-3 pt-3 pb-2">
    <div class="flex items-center justify-between">
      <span class="text-sm font-semibold">webmux</span>
      <IconBtn icon="plus" label="New worktree (Cmd+K)" onclick={() => {}} />
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
    <!-- Needs you -->
    <SectionLabel label="Needs you" collapsed={collapsedGroups.has("inbox")} ontoggle={() => (collapsedGroups = toggled(collapsedGroups, "inbox"))}>
      {#snippet trailing()}
        <span class="shrink-0 rounded-full bg-warning/20 px-1.5 text-[10px] leading-4 font-medium text-warning tabular-nums">{inbox.length + failedProjects.length}</span>
      {/snippet}
    </SectionLabel>
    {#if !collapsedGroups.has("inbox")}
      {#each failedProjects as project (project.prefix)}
        <button
          type="button"
          class="flex w-full cursor-pointer items-start gap-1.5 rounded-md py-1 pr-2 pl-1.5 text-left hover:bg-hover"
          title={project.error}
          oncontextmenu={(e) => (menu = menuAt(e, project.name, projectMenu()))}
        >
          <ProjectAvatar name={project.name} index={0} size="sm" error />
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-[13px]">{project.name}</span>
            <span class="truncate text-[11px] text-danger">Couldn't load worktrees · Retry</span>
          </span>
        </button>
      {/each}
      {#if inbox.length === 0 && failedProjects.length === 0}
        <p class="px-2 pb-1 text-[11px] text-muted">All clear.</p>
      {/if}
      {#each inbox as wt (worktreeKey(wt))}
        {@const key = worktreeKey(wt)}
        {@const reason = reasonOf(wt, notified)}
        <WorktreeLine
          {wt}
          {key}
          attention={attentionOf(wt, notified)}
          selected={key === selected}
          onselect={() => (selected = key)}
          onmenu={(e) => openMenu(e, wt)}
        >
          {#snippet trailing()}
            <ProjectAvatar name={wt.project} index={projectIndex.get(wt.project) ?? 0} size="sm" />
          {/snippet}
          {#snippet below()}
            {#if reason}<span class="block truncate text-[11px] {reason.tone}">{reason.text}</span>{/if}
          {/snippet}
        </WorktreeLine>
      {/each}
    {/if}

    <!-- Running -->
    <SectionLabel label="Running" collapsed={collapsedGroups.has("running")} ontoggle={() => (collapsedGroups = toggled(collapsedGroups, "running"))}>
      {#snippet trailing()}
        <span class="shrink-0 font-normal tabular-nums">{running.length}</span>
      {/snippet}
    </SectionLabel>
    {#if !collapsedGroups.has("running")}
      {#each running as wt (worktreeKey(wt))}
        {@const key = worktreeKey(wt)}
        <WorktreeLine
          {wt}
          {key}
          attention={attentionOf(wt, notified)}
          selected={key === selected}
          onselect={() => (selected = key)}
          onmenu={(e) => openMenu(e, wt)}
        >
          {#snippet trailing()}
            <ProjectAvatar name={wt.project} index={projectIndex.get(wt.project) ?? 0} size="sm" />
          {/snippet}
        </WorktreeLine>
      {/each}
    {/if}

    <!-- Everything else, per project, collapsed by default -->
    <div class="mt-3 border-t border-edge pt-1">
      {#each rest as { project, rows } (project.prefix)}
        {@const isOpen = expanded.has(project.prefix)}
        {@const archivedCount = rows.filter((wt) => wt.archived).length}
        <SectionLabel
          label={project.name}
          collapsed={!isOpen}
          ontoggle={() => (expanded = toggled(expanded, project.prefix))}
          oncontextmenu={(e) => (menu = menuAt(e, project.name, projectMenu()))}
        >
          {#snippet trailing()}
            {#if project.error}<span class="shrink-0 text-[10px] font-medium text-danger normal-case">load failed</span>{/if}
            {#if rows.length - archivedCount > 0}<span class="ml-auto shrink-0 font-normal tabular-nums">{rows.length - archivedCount}</span>{/if}
          {/snippet}
          {#snippet actions()}
            <IconBtn icon="plus" label="New worktree in {project.name}" onclick={() => {}} />
          {/snippet}
        </SectionLabel>
        {#if isOpen}
          {#if project.error}
            <p class="truncate px-2 pb-1 text-[11px] text-danger" title={project.error}>{project.error}</p>
          {/if}
          {#each rows as wt (worktreeKey(wt))}
            {@const key = worktreeKey(wt)}
            {@const pr = primaryPr(wt)}
            <WorktreeLine
              {wt}
              {key}
              attention={attentionOf(wt, notified)}
              selected={key === selected}
              favorite={favorites.has(key)}
              onselect={() => (selected = key)}
              onmenu={(e) => openMenu(e, wt)}
            >
              {#snippet trailing()}
                {#if wt.archived}<span class="shrink-0 text-[10px] text-muted">archived</span>{/if}
                {#if pr}<PrMark {pr} showNumber={false} />{/if}
              {/snippet}
            </WorktreeLine>
          {/each}
        {/if}
      {/each}
    </div>
  </div>

  <SidebarFooter />
</div>

{#if menu}<ContextMenu target={menu} onclose={() => (menu = null)} />{/if}
