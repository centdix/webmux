<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import type { WorktreeInfo, WorktreeListSection, WorktreeRef } from "./types";
  import PrBadge from "./PrBadge.svelte";
  import WorktreeProjectHeader from "./WorktreeProjectHeader.svelte";
  import LinearBadge from "./LinearBadge.svelte";
  import AgentStatusIcon, { agentIconVisible } from "./AgentStatusIcon.svelte";
  import AgentStatusCount from "./AgentStatusCount.svelte";
  import { worktreeCreationPhaseLabel } from "./utils";
  import {
    OVERFLOW_STATUS_BAR_STATUSES,
    OVERFLOW_STATUS_LABELS,
    countAgentStatusesIn,
    keysWithAgentStatus,
    type OverflowStatusBarStatus,
  } from "./worktree-list";
  import { worktreeKey } from "./worktree-ref";
  import { dismissible } from "./dismissible";
  import MenuItem from "./MenuItem.svelte";

  type RowPosition = "above" | "visible" | "below";

  let openMenuKey = $state<string | null>(null);

  // Worktree sets hold `worktreeKey`s; every callback gets the row's ref.
  let {
    sections,
    selected,
    removing,
    initializing,
    archiving,
    postingLinear,
    notified,
    favorites,
    emptyMessage = "No worktrees found.",
    onselect,
    onclose,
    onarchive,
    onremove,
    oneditprofile,
    oncreatesubworktree,
    ontogglefavorite,
    onposttolinear,
    ontogglecollapsed,
    projectActions,
  }: {
    sections: WorktreeListSection[];
    selected: WorktreeRef | null;
    removing: ReadonlySet<string>;
    initializing: ReadonlySet<string>;
    archiving: ReadonlySet<string>;
    postingLinear: ReadonlySet<string>;
    notified: ReadonlySet<string>;
    favorites: ReadonlySet<string>;
    /** Shown when no project is listed (e.g. a search without any match). */
    emptyMessage?: string;
    onselect: (ref: WorktreeRef) => void;
    onclose: (ref: WorktreeRef) => void;
    onarchive: (ref: WorktreeRef) => void;
    onremove: (ref: WorktreeRef) => void;
    oneditprofile: (ref: WorktreeRef) => void;
    oncreatesubworktree: (ref: WorktreeRef) => void;
    ontogglefavorite: (ref: WorktreeRef) => void;
    onposttolinear?: (ref: WorktreeRef) => void;
    ontogglecollapsed: (project: string) => void;
    /** Rendered in each project's header. */
    projectActions?: Snippet<[WorktreeListSection]>;
  } = $props();

  let selectedKey = $derived(selected ? worktreeKey(selected) : null);
  // Rows on screen across every project, in display order.
  let rows = $derived(sections.flatMap((section) => (section.collapsed ? [] : section.rows)));

  function toggleMenu(key: string): void {
    openMenuKey = openMenuKey === key ? null : key;
  }

  function runMenuAction(ref: WorktreeRef, action: (ref: WorktreeRef) => void): void {
    openMenuKey = null;
    action(ref);
  }

  let listEl = $state<HTMLDivElement | null>(null);
  let rowPositions = $state<Map<string, RowPosition>>(new Map());
  let cycleCursor = $state<Record<string, string>>({});

  // Measure the rendered bars (each sits `top-2`/`bottom-2` = 8px off the scroll edge)
  // and the sticky project header so the observer's margins occlude exactly the
  // band they cover — no magic number.
  const BAR_OFFSET = 8;
  let stickyHeaderHeight = $state(0);
  $effect(() => {
    sections.length;
    stickyHeaderHeight = listEl?.querySelector<HTMLElement>("[data-project-header-bar]")?.offsetHeight ?? 0;
  });
  let topBarEl = $state<HTMLElement | null>(null);
  let bottomBarEl = $state<HTMLElement | null>(null);
  let topBarHeight = $state(0);
  let bottomBarHeight = $state(0);
  $effect(() => {
    topBarHeight = topBarEl?.offsetHeight ?? 0;
  });
  $effect(() => {
    bottomBarHeight = bottomBarEl?.offsetHeight ?? 0;
  });
  let rootMargin = $derived(
    `-${Math.max(stickyHeaderHeight, topBarHeight ? topBarHeight + BAR_OFFSET : 0)}px 0px ` +
      `-${bottomBarHeight ? bottomBarHeight + BAR_OFFSET : 0}px 0px`,
  );

  // The identity of the rows present, independent of per-row status churn — changes
  // only when rows are added, removed, collapsed or expanded, not on every agent-status poll.
  let rowsIdentity = $derived(rows.map((row) => worktreeKey(row.worktree)).join("\n"));

  // Track whether each row is scrolled above, into, or below the viewport so the
  // top/bottom floating bars can summarise the agent statuses hidden in each direction.
  $effect(() => {
    const root = listEl;
    if (!root) return;
    rowsIdentity; // re-observe only when rows are added/removed
    const margin = rootMargin; // and when the measured bar band changes

    // Drop tracking for rows that have left the list (untracked so scroll
    // updates to rowPositions don't re-run this effect and rebuild the observer).
    untrack(() => {
      const present = new Set(rows.map((row) => worktreeKey(row.worktree)));
      const pruned = new Map([...rowPositions].filter(([key]) => present.has(key)));
      if (pruned.size !== rowPositions.size) rowPositions = pruned;
    });

    const observer = new IntersectionObserver(
      (entries) => {
        const next = new Map(rowPositions);
        for (const entry of entries) {
          const target = entry.target;
          if (!(target instanceof HTMLElement)) continue;
          const key = target.dataset.worktreeKey;
          if (!key) continue;
          if (entry.isIntersecting) {
            next.set(key, "visible");
          } else {
            const rootTop = entry.rootBounds?.top ?? 0;
            next.set(key, entry.boundingClientRect.top < rootTop ? "above" : "below");
          }
        }
        rowPositions = next;
      },
      // Negative top/bottom margins keep rows tucked behind the floating bars counted as hidden.
      { root, rootMargin: margin, threshold: 0 },
    );
    for (const li of root.querySelectorAll("[data-worktree-key]")) {
      observer.observe(li);
    }
    return () => observer.disconnect();
  });

  function keysAt(position: RowPosition): Set<string> {
    const set = new Set<string>();
    for (const [key, value] of rowPositions) {
      if (value === position) set.add(key);
    }
    return set;
  }

  let aboveKeys = $derived(keysAt("above"));
  let belowKeys = $derived(keysAt("below"));
  let aboveCounts = $derived(countAgentStatusesIn(rows, aboveKeys, notified));
  let belowCounts = $derived(countAgentStatusesIn(rows, belowKeys, notified));
  let hasAbove = $derived(OVERFLOW_STATUS_BAR_STATUSES.some((s) => aboveCounts[s] > 0));
  let hasBelow = $derived(OVERFLOW_STATUS_BAR_STATUSES.some((s) => belowCounts[s] > 0));

  function cycleToStatus(status: OverflowStatusBarStatus, direction: "above" | "below"): void {
    const keys = keysWithAgentStatus(
      rows,
      status,
      direction === "above" ? aboveKeys : belowKeys,
      notified,
    );
    // Cycle nearest-to-the-fold first: below rows are already in that order, above
    // rows need reversing so the first click lands on the row just above the fold.
    if (direction === "above") keys.reverse();
    if (keys.length === 0 || !listEl) return;
    const cursor = `${direction}:${status}`;
    // Advance from the last row we scrolled to; if it has since scrolled into
    // view (no longer in the list), indexOf is -1 and we restart from the first.
    const nextIndex = (keys.indexOf(cycleCursor[cursor] ?? "") + 1) % keys.length;
    const nextKey = keys[nextIndex];
    cycleCursor = { ...cycleCursor, [cursor]: nextKey };
    const target = Array.from(listEl.querySelectorAll<HTMLElement>("[data-worktree-key]")).find(
      (el) => el.dataset.worktreeKey === nextKey,
    );
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
</script>

<div class="relative flex min-h-0 flex-1 flex-col">
  <div bind:this={listEl} class="overflow-y-auto flex-1 min-h-0 px-2 pb-2">
    {#if sections.length === 0}
      <p class="px-3 py-4 text-xs text-muted text-center">{emptyMessage}</p>
    {/if}
    {#each sections as section, index (section.prefix)}
      {@const listId = `worktree-list-${section.prefix}`}
      <section aria-label={section.name} data-project={section.prefix}>
        <WorktreeProjectHeader
          name={section.name}
          count={section.rows.length}
          collapsed={section.collapsed}
          error={section.error}
          {listId}
          separated={index > 0}
          statusCounts={countAgentStatusesIn(section.rows, undefined, notified)}
          ontoggle={() => ontogglecollapsed(section.prefix)}
        >
          {#if projectActions}{@render projectActions(section)}{/if}
        </WorktreeProjectHeader>
        {#if !section.collapsed}
          <ul id={listId} class="list-none">
            {#if section.emptyMessage !== null}
              <li class="px-3 py-2 text-xs text-muted">{section.emptyMessage}</li>
            {/if}
            {#each section.rows as row (worktreeKey(row.worktree))}
              {@render worktreeRow(row.worktree, row.depth)}
            {/each}
          </ul>
        {/if}
      </section>
    {/each}
  </div>
  {#if hasAbove}
    <div
      bind:this={topBarEl}
      class="pointer-events-none absolute inset-x-0 top-2 flex justify-center"
    >
      {@render statusBar(aboveCounts, "above")}
    </div>
  {/if}
  {#if hasBelow}
    <div
      bind:this={bottomBarEl}
      class="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center"
    >
      {@render statusBar(belowCounts, "below")}
    </div>
  {/if}
</div>

{#snippet worktreeRow(wt: WorktreeInfo, depth: number)}
  {@const ref = { project: wt.project, branch: wt.branch }}
  {@const key = worktreeKey(wt)}
  {@const isActive = key === selectedKey}
  {@const isRemoving = removing.has(key)}
  {@const isClosed = wt.mux !== "✓"}
  {@const isInitializing = initializing.has(key)}
  {@const isArchiving = archiving.has(key)}
  {@const isCreating = wt.creating}
  {@const isArchived = wt.archived}
  {@const isFavorite = favorites.has(key)}
  {@const isNotified = notified.has(key)}
  {@const isBusy = isRemoving || isInitializing}
  {@const hasLabel = !!wt.label}
  {@const hasBadgeRow = isArchived || isCreating || isInitializing || isClosed || wt.prs.length > 0 || !!wt.linearIssue || wt.source === "oneshot"}
  <li
    data-worktree-key={key}
    class="mb-0.5 group relative {isBusy ? 'opacity-40 pointer-events-none' : ''}"
  >
    <button
      type="button"
      disabled={isBusy}
      class="w-full py-2.5 rounded-md border cursor-pointer flex flex-col gap-1 text-left text-inherit text-sm bg-transparent hover:bg-hover {isActive
        ? 'bg-active border-accent'
        : 'border-transparent'} {isClosed && !isInitializing && !isCreating ? 'opacity-50' : ''} {isArchived ? 'opacity-70' : ''}"
      style={`padding-left:${12 + depth * 18}px; padding-right:64px;`}
      onclick={() => {
        openMenuKey = null;
        onselect(ref);
      }}
    >
      <span class="flex min-w-0 items-start gap-2">
        {#if depth > 0}
          <span class="shrink-0 text-muted/60">↳</span>
        {/if}
        <span class="min-w-0 flex flex-1 flex-col gap-1">
          <span class="flex min-w-0 items-center gap-1.5" data-worktree-name-row>
            <span class="min-w-0 flex flex-1 flex-col">
              <span class="font-medium truncate">{wt.label ?? wt.branch}</span>
              {#if hasLabel}
                <span class="text-[10px] leading-tight text-muted truncate">{wt.branch}</span>
              {/if}
            </span>
            {#if !isCreating && !isInitializing && !isClosed && agentIconVisible(wt.agent, isNotified)}
              <span class="shrink-0"
                ><AgentStatusIcon
                  status={wt.agent}
                  size={14}
                  unread={isNotified}
                /></span
              >
            {/if}
          </span>
          {#if hasBadgeRow}
            <span class="flex min-w-0 flex-wrap items-center gap-1.5" data-worktree-badge-row>
              {#if wt.source === "oneshot"}
                <span
                  class="shrink-0 text-[10px] px-1.5 py-0.5 rounded border border-edge text-muted"
                  title="Autonomous run — auto-closes when done"
                >
                  oneshot
                </span>
              {/if}
              {#if isArchived}
                <span class="shrink-0 text-[10px] px-1.5 py-0.5 rounded border border-edge text-muted">
                  archived
                </span>
              {/if}
              {#if isCreating}
                <span class="shrink-0 inline-flex items-center gap-1 text-[10px] text-muted">
                  <span class="spinner"></span>
                  {worktreeCreationPhaseLabel(wt.creationPhase)}...
                </span>
              {:else if isInitializing}
                <span class="shrink-0 text-[10px] text-muted">opening...</span>
              {:else if isClosed}
                <span class="shrink-0 text-[10px] text-muted">closed</span>
              {/if}
              {#each wt.prs as pr (pr.repo)}
                <PrBadge {pr} />
              {/each}
              {#if wt.linearIssue}
                <LinearBadge issue={wt.linearIssue} clickable={false} />
              {/if}
            </span>
          {/if}
        </span>
      </span>
      <span class="flex gap-2 text-[11px] text-muted items-center flex-wrap">
        {#if wt.agentLabel ?? wt.agentName}
          <span>{wt.agentLabel ?? wt.agentName}</span>
        {/if}
        {#if wt.profile}
          <span>{wt.profile}</span>
        {/if}
      </span>
      {#if wt.services.length > 0}
        <span class="flex gap-2 text-[11px] text-muted font-mono">
          {#each wt.services as svc}
            {#if svc.port}
              <span class={svc.running ? "text-success" : ""}>{svc.name}:{svc.port}</span>
            {/if}
          {/each}
        </span>
      {/if}
    </button>
    <button
      type="button"
      disabled={isBusy}
      class="absolute top-2 right-8 w-6 h-6 rounded flex items-center justify-center hover:bg-hover cursor-pointer {isFavorite
        ? 'text-warning'
        : 'text-muted hover:text-warning'}"
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
      aria-label={`${isFavorite ? "Remove" : "Add"} ${wt.branch} ${isFavorite ? "from" : "to"} favorites`}
      aria-pressed={isFavorite}
      data-worktree-favorite
      onclick={(event) => {
        event.stopPropagation();
        ontogglefavorite(ref);
      }}
    >
      {isFavorite ? "★" : "☆"}
    </button>
    <button
      type="button"
      disabled={isBusy}
      class="absolute top-2 right-2 w-6 h-6 rounded flex items-center justify-center text-muted hover:text-primary hover:bg-hover opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
      title="Worktree actions"
      aria-label={`Actions for ${wt.branch}`}
      aria-haspopup="menu"
      aria-expanded={openMenuKey === key}
      onclick={(event) => {
        event.stopPropagation();
        toggleMenu(key);
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="19" r="1" />
      </svg>
    </button>
    {#if openMenuKey === key}
      <div
        class="absolute top-9 right-2 z-10 min-w-32 rounded-md border border-edge bg-surface shadow-lg p-1"
        {@attach dismissible(() => (openMenuKey = null))}
      >
        <MenuItem disabled={isClosed || isCreating} onclick={() => runMenuAction(ref, onclose)}>Close</MenuItem>
        <MenuItem disabled={isCreating || isArchiving} onclick={() => runMenuAction(ref, onarchive)}>
          {wt.archived ? "Restore" : "Archive"}
        </MenuItem>
        <MenuItem disabled={isCreating} onclick={() => runMenuAction(ref, oneditprofile)}>Change profile…</MenuItem>
        <MenuItem disabled={isCreating} onclick={() => runMenuAction(ref, oncreatesubworktree)}>Create sub-worktree</MenuItem>
        <MenuItem danger onclick={() => runMenuAction(ref, onremove)}>Remove</MenuItem>
        {#if onposttolinear}
          {@const isPostingLinear = postingLinear.has(key)}
          <div class="my-1 border-t border-edge"></div>
          <MenuItem disabled={isPostingLinear} onclick={() => runMenuAction(ref, onposttolinear)}>
            {#if isPostingLinear}
              Posting to Linear…
            {:else if wt.linearIssue}
              Post conversation to {wt.linearIssue.identifier}
            {:else}
              Post conversation to Linear…
            {/if}
          </MenuItem>
        {/if}
      </div>
    {/if}
  </li>
{/snippet}

{#snippet statusBar(counts: Record<OverflowStatusBarStatus, number>, direction: "above" | "below")}
  <div
    class="pointer-events-auto flex items-center gap-1 rounded-full border border-edge bg-surface/90 px-1.5 py-1 shadow-lg backdrop-blur"
  >
    {#each OVERFLOW_STATUS_BAR_STATUSES as status}
      {#if counts[status] > 0}
        <button
          type="button"
          class="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums hover:bg-hover cursor-pointer"
          title={`Scroll to next ${OVERFLOW_STATUS_LABELS[status]} worktree ${direction}`}
          onclick={() => cycleToStatus(status, direction)}
        >
          <AgentStatusCount {status} count={counts[status]} />
        </button>
      {/if}
    {/each}
  </div>
{/snippet}
