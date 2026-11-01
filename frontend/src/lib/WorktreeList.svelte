<script lang="ts">
  import { untrack } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import type { ActiveListRow, PendingCreationInfo, PrEntry, ProjectListRows, WorktreeInfo, WorktreeRef } from "./types";
  import AgentStatusCount from "./AgentStatusCount.svelte";
  import Btn from "./Btn.svelte";
  import ContextMenu from "./ContextMenu.svelte";
  import IconBtn from "./IconBtn.svelte";
  import MenuItem from "./MenuItem.svelte";
  import PrMark from "./PrMark.svelte";
  import WorktreeStatusGlyph from "./WorktreeStatusGlyph.svelte";
  import {
    OVERFLOW_STATUS_BAR_STATUSES,
    OVERFLOW_STATUS_LABELS,
    countAgentStatusesIn,
    keysWithAgentStatus,
    listRowKey,
    worktreeRowsOf,
    type OverflowStatusBarStatus,
  } from "./worktree-list";
  import { attentionLabel, attentionOf, creatingLabel, rowPr, type Attention } from "./worktree-status";
  import { worktreeKey } from "./worktree-ref";

  type RowPosition = "above" | "visible" | "below";

  // Worktree sets hold `worktreeKey`s; every callback gets the row's ref.
  let {
    rows,
    showArchived,
    query,
    error,
    selected,
    removing,
    initializing,
    archiving,
    postingLinear,
    notified,
    favorites,
    isMobile = false,
    onselect,
    ontogglearchived,
    onretry,
    oncreate,
    onopen,
    onclose,
    onarchive,
    onremove,
    oneditlabel,
    oneditprofile,
    oncreatesubworktree,
    ontogglefavorite,
    onposttolinear,
  }: {
    /** The current project's rows, filtered by the search. */
    rows: ProjectListRows;
    /** The archived group, folded at the bottom, is open. */
    showArchived: boolean;
    /** The trimmed search, for the empty message. */
    query: string;
    /** The project's last load error. */
    error: string | null;
    selected: WorktreeRef | null;
    removing: ReadonlySet<string>;
    initializing: ReadonlySet<string>;
    archiving: ReadonlySet<string>;
    postingLinear: ReadonlySet<string>;
    notified: ReadonlySet<string>;
    favorites: ReadonlySet<string>;
    /** Mobile layout: ⋯ on every row, as long-press doesn't open the menu everywhere. */
    isMobile?: boolean;
    onselect: (ref: WorktreeRef) => void;
    ontogglearchived: () => void;
    onretry: () => void;
    /** New worktree in this project, offered when it has none. */
    oncreate: () => void;
    onopen: (ref: WorktreeRef) => void;
    onclose: (ref: WorktreeRef) => void;
    onarchive: (ref: WorktreeRef) => void;
    onremove: (ref: WorktreeRef) => void;
    oneditlabel: (ref: WorktreeRef) => void;
    oneditprofile: (ref: WorktreeRef) => void;
    oncreatesubworktree: (ref: WorktreeRef) => void;
    ontogglefavorite: (ref: WorktreeRef) => void;
    onposttolinear?: (ref: WorktreeRef) => void;
  } = $props();

  // A touch device of any width (iPad) has no hover or right-click either.
  const touchDevice = new MediaQuery("(hover: none), (pointer: coarse)");
  let menuOnEveryRow = $derived(isMobile || touchDevice.current);

  let selectedKey = $derived(selected ? worktreeKey(selected) : null);
  /** Worktree rows on screen, top to bottom (creations still naming their branch left out). */
  let shownRows = $derived([...worktreeRowsOf(rows.active), ...(showArchived ? rows.archived : [])]);

  let menu = $state<{ key: string; x: number; y: number; trigger: HTMLElement } | null>(null);
  let menuWorktree = $derived(menu ? shownRows.find((row) => worktreeKey(row.worktree) === menu?.key)?.worktree : undefined);
  // A menu whose row left the list (project switch, search) closes for good.
  $effect(() => {
    if (menu && !menuWorktree) menu = null;
  });

  /** Right-click opens at the pointer; the ⋯ button and the keyboard
   *  (Shift+F10, the ContextMenu key) under the button or row. A second click
   *  on ⋯ closes it. */
  function openMenu(event: MouseEvent, key: string): void {
    event.preventDefault();
    if (!(event.currentTarget instanceof HTMLElement)) return;
    const trigger = event.currentTarget;
    if (event.type === "click" && menu?.trigger === trigger) {
      menu = null;
    } else if (event.type === "contextmenu" && (event.button === 2 || event.ctrlKey)) {
      menu = { key, x: event.clientX, y: event.clientY, trigger };
    } else {
      const rect = trigger.getBoundingClientRect();
      menu = { key, x: rect.left, y: rect.bottom + 2, trigger };
    }
  }

  function runMenuAction(ref: WorktreeRef, action: (ref: WorktreeRef) => void): void {
    menu = null;
    action({ project: ref.project, branch: ref.branch });
  }

  let listEl = $state<HTMLDivElement | null>(null);
  let rowPositions = $state<Map<string, RowPosition>>(new Map());
  let cycleCursor = $state<Record<string, string>>({});

  // Measure the rendered bars (each sits `top-2`/`bottom-2` = 8px off the scroll
  // edge) so the observer's margins occlude exactly the band they cover.
  const BAR_OFFSET = 8;
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
    `-${topBarHeight ? topBarHeight + BAR_OFFSET : 0}px 0px -${bottomBarHeight ? bottomBarHeight + BAR_OFFSET : 0}px 0px`,
  );

  // The identity of the rows present, independent of per-row status churn — changes
  // only when rows are added or removed, not on every agent-status poll.
  let rowsIdentity = $derived(shownRows.map((row) => worktreeKey(row.worktree)).join("\n"));

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
      const present = new Set(shownRows.map((row) => worktreeKey(row.worktree)));
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
  let aboveCounts = $derived(countAgentStatusesIn(shownRows, aboveKeys, notified));
  let belowCounts = $derived(countAgentStatusesIn(shownRows, belowKeys, notified));
  let hasAbove = $derived(OVERFLOW_STATUS_BAR_STATUSES.some((s) => aboveCounts[s] > 0));
  let hasBelow = $derived(OVERFLOW_STATUS_BAR_STATUSES.some((s) => belowCounts[s] > 0));

  function cycleToStatus(status: OverflowStatusBarStatus, direction: "above" | "below"): void {
    const keys = keysWithAgentStatus(shownRows, status, direction === "above" ? aboveKeys : belowKeys, notified);
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

  /** The title's "agent · profile" line, null when both are empty. */
  function agentProfileLine(row: Pick<WorktreeInfo, "agentLabel" | "agentName" | "profile">): string | null {
    return [row.agentLabel ?? row.agentName, row.profile].filter(Boolean).join(" · ") || null;
  }

  function rowTitle(wt: WorktreeInfo, attention: Attention, opening: boolean): string {
    return [
      wt.label || wt.creating ? wt.branch : null,
      agentProfileLine(wt),
      wt.source === "oneshot" ? "Autonomous run — auto-closes when done" : null,
      opening ? "Opening…" : attentionLabel(attention, wt),
    ].filter((line) => line !== null).join("\n");
  }

  function pendingRowTitle(pending: PendingCreationInfo): string {
    return [agentProfileLine(pending), creatingLabel(pending.phase)].filter((line) => line !== null).join("\n");
  }

  /** What a row shows; `target` is null for a creation still naming its branch. */
  interface RowView {
    target: { wt: WorktreeInfo; key: string } | null;
    isBusy: boolean;
    attention: Attention;
    dim: boolean;
    pr: PrEntry | null;
    name: string;
    title: string;
  }

  function rowView(row: ActiveListRow): RowView {
    switch (row.kind) {
      case "pending":
        return {
          target: null,
          isBusy: false,
          attention: "creating",
          dim: true,
          pr: null,
          name: creatingLabel(row.pending.phase),
          title: pendingRowTitle(row.pending),
        };
      case "worktree": {
        const wt = row.worktree;
        const key = worktreeKey(wt);
        const isInitializing = initializing.has(key);
        const attention = isInitializing ? "creating" : attentionOf(wt, notified);
        return {
          target: { wt, key },
          isBusy: removing.has(key) || isInitializing,
          attention,
          dim: attention === "closed" || attention === "creating" || wt.archived,
          pr: rowPr(wt),
          name: wt.creating ? attentionLabel(attention, wt) : (wt.label ?? wt.branch),
          title: rowTitle(wt, attention, isInitializing),
        };
      }
    }
  }
</script>

<div class="relative flex min-h-0 flex-1 flex-col">
  <div bind:this={listEl} class="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
    {#if error !== null}
      <div class="m-1 mb-2 flex flex-col items-start gap-2 rounded-md border border-danger/30 bg-danger/5 p-2.5 text-[11px]" data-project-error>
        <span class="font-medium text-danger">Couldn't load worktrees</span>
        <span class="font-mono break-all text-muted">{error}</span>
        <Btn small type="button" onclick={onretry}>Retry</Btn>
      </div>
    {/if}
    {#if rows.active.length === 0 && error === null}
      <div class="flex flex-col items-center gap-2 px-3 py-4 text-center text-xs text-muted">
        {#if query}
          <p>No {rows.archived.length > 0 ? "active " : ""}matches for "{query}".</p>
        {:else if rows.archived.length > 0}
          <p>No active worktrees.</p>
        {:else}
          <p>No worktrees yet.</p>
          <Btn small type="button" variant="accent-outline" onclick={oncreate}>New worktree</Btn>
        {/if}
      </div>
    {/if}
    <ul class="list-none" aria-label="Worktrees">
      {#each rows.active as row (listRowKey(row))}
        {@render worktreeRow(row)}
      {/each}
    </ul>
    {#if rows.archived.length > 0}
      <button
        type="button"
        class="mt-2 flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-md pl-1.5 text-left text-[11px] font-semibold tracking-wide text-muted uppercase hover:bg-hover"
        aria-expanded={showArchived}
        onclick={ontogglearchived}
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
          class="shrink-0 opacity-60 transition-transform {showArchived ? '' : '-rotate-90'}"
          aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg
        >
        Archived ({rows.archived.length})
      </button>
      {#if showArchived}
        <ul class="list-none" aria-label="Archived worktrees">
          {#each rows.archived as row (listRowKey(row))}
            {@render worktreeRow(row)}
          {/each}
        </ul>
      {/if}
    {/if}
  </div>
  {#if hasAbove}
    <div bind:this={topBarEl} class="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
      {@render statusBar(aboveCounts, "above")}
    </div>
  {/if}
  {#if hasBelow}
    <div bind:this={bottomBarEl} class="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
      {@render statusBar(belowCounts, "below")}
    </div>
  {/if}
</div>

{#if menu && menuWorktree}
  {@const wt = menuWorktree}
  {@const key = menu.key}
  {@const isCreating = wt.creating}
  {@const isFavorite = favorites.has(key)}
  <ContextMenu x={menu.x} y={menu.y} label={wt.label ?? wt.branch} trigger={menu.trigger} onclose={() => (menu = null)}>
    {#if wt.mux === "✓"}
      <MenuItem disabled={isCreating} onclick={() => runMenuAction(wt, onclose)}>Close</MenuItem>
    {:else}
      <MenuItem disabled={isCreating || initializing.has(key)} onclick={() => runMenuAction(wt, onopen)}>Open</MenuItem>
    {/if}
    <MenuItem onclick={() => runMenuAction(wt, ontogglefavorite)}>
      {isFavorite ? "Remove from favorites" : "Add to favorites"}
    </MenuItem>
    <MenuItem onclick={() => runMenuAction(wt, oneditlabel)}>Edit label…</MenuItem>
    <MenuItem disabled={isCreating} onclick={() => runMenuAction(wt, oneditprofile)}>Change profile…</MenuItem>
    <MenuItem disabled={isCreating} onclick={() => runMenuAction(wt, oncreatesubworktree)}>Create sub-worktree</MenuItem>
    <div class="my-1 border-t border-edge"></div>
    {#if onposttolinear}
      {@const isPostingLinear = postingLinear.has(key)}
      <MenuItem disabled={isPostingLinear} onclick={() => runMenuAction(wt, onposttolinear)}>
        {#if isPostingLinear}
          Posting to Linear…
        {:else if wt.linearIssue}
          Post conversation to {wt.linearIssue.identifier}
        {:else}
          Post conversation to Linear…
        {/if}
      </MenuItem>
    {/if}
    <MenuItem disabled={isCreating || archiving.has(key)} onclick={() => runMenuAction(wt, onarchive)}>
      {wt.archived ? "Restore" : "Archive"}
    </MenuItem>
    <MenuItem danger onclick={() => runMenuAction(wt, onremove)}>Remove</MenuItem>
  </ContextMenu>
{/if}

<!-- A creation still naming its branch renders through the same markup, as a
     disabled row, so it keeps its elements once its worktree exists. -->
{#snippet worktreeRow(row: ActiveListRow)}
  {@const { target, isBusy, attention, dim, pr, name, title } = rowView(row)}
  {@const isActive = target !== null && target.key === selectedKey}
  <li
    data-worktree-key={target?.key}
    class="group relative rounded-md {isActive ? 'bg-active shadow-[inset_2px_0_0_var(--color-accent)]' : target ? 'hover:bg-hover' : ''} {isBusy
      ? 'pointer-events-none opacity-40'
      : ''}"
  >
    <div class="flex min-h-7 items-center">
      <button
        type="button"
        disabled={isBusy || !target}
        class="flex min-h-7 min-w-0 flex-1 cursor-pointer items-center gap-1.5 pr-1 text-left text-[13px] text-primary disabled:cursor-default"
        style="padding-left:{6 + row.depth * 14}px"
        {title}
        aria-current={isActive ? "true" : undefined}
        onclick={() => {
          if (!target) return;
          menu = null;
          onselect({ project: target.wt.project, branch: target.wt.branch });
        }}
        oncontextmenu={(event: MouseEvent) => {
          if (target) openMenu(event, target.key);
        }}
      >
        <WorktreeStatusGlyph {attention} />
        <span class="min-w-0 flex-1 truncate {dim ? 'text-muted' : ''} {attention === 'creating' ? 'italic' : ''}">{name}</span>
        {#if target && favorites.has(target.key)}<span class="shrink-0 text-[10px] text-warning/80" aria-hidden="true">★</span>{/if}
        {#if pr}<PrMark {pr} />{/if}
      </button>
      {#if target && (isActive || menuOnEveryRow)}
        <IconBtn
          icon="more"
          label="Actions for {target.wt.branch}"
          title="Worktree actions"
          class="mr-0.5"
          disabled={isBusy}
          aria-expanded={menu?.key === target.key}
          onclick={(event) => openMenu(event, target.key)}
        />
      {/if}
    </div>
  </li>
{/snippet}

{#snippet statusBar(counts: Record<OverflowStatusBarStatus, number>, direction: "above" | "below")}
  <div class="pointer-events-auto flex items-center gap-1 rounded-full border border-edge bg-surface/90 px-1.5 py-1 shadow-lg backdrop-blur">
    {#each OVERFLOW_STATUS_BAR_STATUSES as status (status)}
      {#if counts[status] > 0}
        <button
          type="button"
          class="flex cursor-pointer items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums hover:bg-hover"
          title={`Scroll to next ${OVERFLOW_STATUS_LABELS[status]} worktree ${direction}`}
          onclick={() => cycleToStatus(status, direction)}
        >
          <AgentStatusCount {status} count={counts[status]} />
        </button>
      {/if}
    {/each}
  </div>
{/snippet}
