<script lang="ts">
  import type { ProjectRailItem } from "./types";
  import { projectRailTitle } from "./project-rail";
  import IconBtn from "./IconBtn.svelte";
  import ContextMenu from "./ContextMenu.svelte";

  let {
    items,
    current,
    showShortcuts,
    onselect,
    onaddproject,
    onsettings,
  }: {
    items: ProjectRailItem[];
    /** Prefix of the project the list shows. */
    current: string;
    /** Offer the keyboard shortcuts (desktop). */
    showShortcuts: boolean;
    onselect: (prefix: string) => void;
    onaddproject: () => void;
    onsettings: () => void;
  } = $props();

  const SHORTCUTS: Array<[string, string]> = [
    ["Switch worktree", "Cmd+Up/Down"],
    ["Switch project", "Cmd+Shift+Up/Down"],
    ["New worktree", "Cmd+K"],
    ["Remove worktree", "Cmd+D"],
    ["Open a closed worktree", "Cmd+Enter"],
  ];

  let shortcutsAt = $state<{ x: number; y: number; trigger: HTMLElement } | null>(null);

  function toggleShortcuts(event: MouseEvent): void {
    if (shortcutsAt || !(event.currentTarget instanceof HTMLElement)) {
      shortcutsAt = null;
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    shortcutsAt = { x: rect.right + 6, y: rect.bottom, trigger: event.currentTarget };
  }
</script>

<nav class="flex w-12 shrink-0 flex-col items-center border-r border-edge bg-surface/40" aria-label="Projects">
  <ul class="flex min-h-0 w-full flex-1 list-none flex-col items-center gap-3 overflow-y-auto py-2.5">
    {#each items as item (item.prefix)}
      {@const isCurrent = item.prefix === current}
      <li>
        <button
          type="button"
          class="relative flex cursor-pointer items-center justify-center rounded-lg {isCurrent
            ? 'ring-2 ring-accent/70'
            : 'opacity-75 hover:opacity-100'}"
          title={projectRailTitle(item)}
          aria-label={projectRailTitle(item)}
          aria-current={isCurrent ? "page" : undefined}
          data-project-rail-item={item.prefix}
          onclick={() => onselect(item.prefix)}
        >
          <span
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-semibold tracking-tight {item.error !== null
              ? 'bg-danger/15 text-danger'
              : item.tint}"
            aria-hidden="true">{item.initials}</span
          >
          {#if item.error !== null}
            <span
              class="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-surface ring-2 ring-sidebar"
              data-rail-badge="error">!</span
            >
          {:else if item.needsYou > 0}
            <span
              class="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[9px] font-bold text-surface tabular-nums ring-2 ring-sidebar"
              data-rail-badge="needs-you">{item.needsYou}</span
            >
          {/if}
          {#if item.running}
            <span
              class="absolute -right-1 -bottom-1 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-sidebar"
              data-rail-badge="running"
            ></span>
          {/if}
        </button>
      </li>
    {/each}
  </ul>
  <div class="flex shrink-0 flex-col items-center gap-1.5 py-2.5">
    <IconBtn icon="plus" label="Add project" class="h-8 w-8 rounded-lg border border-dashed border-edge" onclick={onaddproject} />
    {#if showShortcuts}
      <IconBtn icon="help" label="Keyboard shortcuts" onclick={toggleShortcuts} />
    {/if}
    <IconBtn icon="gear" label="Settings" onclick={onsettings} />
  </div>
</nav>

{#if shortcutsAt}
  <ContextMenu
    x={shortcutsAt.x}
    y={shortcutsAt.y}
    label="Keyboard shortcuts"
    role="dialog"
    trigger={shortcutsAt.trigger}
    onclose={() => (shortcutsAt = null)}
  >
    <dl class="flex flex-col gap-1 px-2 pb-1 text-[11px]">
      {#each SHORTCUTS as [action, keys] (action)}
        <div class="flex justify-between gap-4">
          <dt class="text-primary">{action}</dt>
          <dd><kbd class="text-muted">{keys}</kbd></dd>
        </div>
      {/each}
    </dl>
  </ContextMenu>
{/if}
