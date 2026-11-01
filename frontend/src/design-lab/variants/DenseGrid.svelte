<script lang="ts">
  import type { WorktreeInfo } from "../../lib/types";
  import { buildWorktreeListRows, sortFavoritesFirst } from "../../lib/worktree-list";
  import { ciStatusDotClass, prStateTextClass } from "../../lib/utils";
  import {
    attentionOf,
    displayName,
    menuAt,
    primaryPr,
    projectMenu,
    scrollKeyIntoView,
    searchFilter,
    stepSelection,
    worktreeKey,
    worktreeMenu,
    type Attention,
    type MenuTarget,
    type VariantProps,
  } from "../lab";
  import StatusGlyph from "../components/StatusGlyph.svelte";
  import ContextMenu from "../components/ContextMenu.svelte";
  import SearchField from "../components/SearchField.svelte";
  import IconBtn from "../components/IconBtn.svelte";
  import ProjectAvatar from "../components/ProjectAvatar.svelte";

  let { projects, notified, favorites, selected = $bindable(null) }: VariantProps = $props();

  const URGENCY: Attention[] = ["waiting", "error", "unread", "working", "creating", "idle", "closed"];

  let query = $state("");
  let sortBy = $state<"project" | "status">("project");
  let showArchived = $state(false);
  let menu = $state<MenuTarget | null>(null);
  let listEl = $state<HTMLElement | null>(null);

  let projectIndex = $derived(new Map(projects.map((p, i) => [p.prefix, i])));
  let archivedCount = $derived(projects.flatMap((p) => p.worktrees).filter((wt) => wt.archived).length);
  let rows = $derived.by(() => {
    const perProject = projects.flatMap((p) =>
      buildWorktreeListRows(
        sortFavoritesFirst(
          searchFilter(p.worktrees, query).filter((wt) => showArchived || !wt.archived),
          favorites,
        ),
      ),
    );
    if (sortBy === "project") return perProject;
    return perProject
      .map((r) => ({ ...r, depth: 0 }))
      .sort((a, b) => URGENCY.indexOf(attentionOf(a.worktree, notified)) - URGENCY.indexOf(attentionOf(b.worktree, notified)));
  });
  let failedProjects = $derived(projects.filter((p) => p.error !== null));

  function onkeydown(event: KeyboardEvent): void {
    const next = stepSelection(event, rows.map((r) => worktreeKey(r.worktree)), selected ?? null);
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
  <div class="flex items-center gap-1.5 px-2 pt-2 pb-1.5">
    <div class="min-w-0 flex-1"><SearchField bind:value={query} placeholder="Filter" /></div>
    <IconBtn icon="plus" label="New worktree (Cmd+K)" onclick={() => {}} />
  </div>

  <div class="flex items-center gap-1 border-b border-edge px-2 pb-1.5 text-[10px] text-muted">
    <span>Sort</span>
    {#each ["project", "status"] as const as option (option)}
      <button
        type="button"
        class="cursor-pointer rounded px-1.5 py-0.5 {sortBy === option ? 'bg-hover text-primary' : 'hover:text-primary'}"
        onclick={() => (sortBy = option)}>{option}</button
      >
    {/each}
    <span class="ml-auto flex items-center gap-1.5 font-mono tracking-tight uppercase">
      <span class="w-4 text-center" title="Agent">ag</span>
      <span class="w-11 text-right" title="Pull request">pr</span>
      <span class="w-4 text-center" title="CI">ci</span>
      <span class="w-5 text-right" title="Review comments">rv</span>
    </span>
  </div>

  <div
    bind:this={listEl}
    class="min-h-0 flex-1 overflow-y-auto py-1 focus:outline-none"
    role="listbox"
    tabindex="0"
    aria-label="Worktrees"
    {onkeydown}
  >
    {#each rows as { worktree: wt, depth }, i (worktreeKey(wt))}
      {@const key = worktreeKey(wt)}
      {@const pr = primaryPr(wt)}
      {@const isSelected = key === selected}
      {@const attention = attentionOf(wt, notified)}
      {@const newProject = sortBy === "project" && i > 0 && rows[i - 1].worktree.project !== wt.project}
      <button
        type="button"
        role="option"
        aria-selected={isSelected}
        data-key={key}
        class="flex h-[22px] w-full cursor-pointer items-center gap-1.5 pr-2 pl-2 text-left text-xs {isSelected
          ? 'bg-active shadow-[inset_2px_0_0_var(--color-accent)]'
          : 'hover:bg-hover'} {newProject ? 'mt-1' : ''}"
        title="{wt.project} / {wt.branch}"
        onclick={() => (selected = key)}
        oncontextmenu={(e) => openMenu(e, wt)}
      >
        <ProjectAvatar name={wt.project} index={projectIndex.get(wt.project) ?? 0} size="sm" />
        <span
          class="min-w-0 flex-1 truncate {attention === 'closed' || wt.archived || attention === 'creating' ? 'text-muted' : ''}"
          style="padding-left:{depth * 10}px">{depth > 0 ? "└ " : ""}{displayName(wt)}</span
        >
        <span class="flex w-4 shrink-0 justify-center"><StatusGlyph {attention} size={11} /></span>
        <span class="w-11 shrink-0 text-right font-mono text-[10px] tabular-nums {pr ? prStateTextClass(pr) : ''}">
          {pr ? `#${pr.number}` : ""}
        </span>
        <span class="flex w-4 shrink-0 justify-center">
          {#if pr && pr.ciStatus !== "none" && pr.state === "open"}
            <span class="h-1.5 w-1.5 rounded-full {ciStatusDotClass(pr.ciStatus)}" title="CI {pr.ciStatus}"></span>
          {/if}
        </span>
        <span class="w-5 shrink-0 text-right font-mono text-[10px] tabular-nums text-warning">
          {pr && pr.comments.length > 0 && pr.state === "open" ? pr.comments.length : ""}
        </span>
      </button>
    {/each}
    {#each failedProjects as project (project.prefix)}
      <button
        type="button"
        class="mt-1 flex h-[22px] w-full cursor-pointer items-center gap-1.5 px-2 text-left text-xs text-danger hover:bg-hover"
        title={project.error}
        oncontextmenu={(e) => (menu = menuAt(e, project.name, projectMenu()))}
      >
        <ProjectAvatar name={project.name} index={0} size="sm" error />
        <span class="min-w-0 flex-1 truncate">{project.name}: couldn't load</span>
        <span class="shrink-0 text-[10px] text-muted">retry</span>
      </button>
    {/each}
  </div>

  <div class="flex shrink-0 items-center gap-1 border-t border-edge px-2 py-1 text-[10px] text-muted">
    <button type="button" class="cursor-pointer rounded px-1.5 py-0.5 hover:bg-hover hover:text-primary" onclick={() => (showArchived = !showArchived)}>
      {showArchived ? "Hide" : "Show"} archived ({archivedCount})
    </button>
    <span class="ml-auto">{rows.length} worktrees · {projects.length} projects</span>
    <IconBtn icon="gear" label="Settings" onclick={() => {}} />
  </div>
</div>

{#if menu}<ContextMenu target={menu} onclose={() => (menu = null)} />{/if}
