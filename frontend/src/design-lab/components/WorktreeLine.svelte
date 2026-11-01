<script lang="ts">
  import type { Snippet } from "svelte";
  import type { WorktreeInfo } from "../../lib/types";
  import { displayName, type Attention } from "../lab";
  import StatusGlyph from "./StatusGlyph.svelte";
  import IconBtn from "./IconBtn.svelte";

  let {
    wt,
    key,
    attention,
    selected,
    depth = 0,
    favorite = false,
    onselect,
    onmenu,
    trailing,
    actions,
    below,
    class: className = "",
  }: {
    wt: WorktreeInfo;
    key: string;
    attention: Attention;
    selected: boolean;
    depth?: number;
    favorite?: boolean;
    onselect: () => void;
    /** Context menu (right-click, or the ⋯ of the selected row). */
    onmenu: (event: MouseEvent) => void;
    /** Right-aligned marks on the name line. */
    trailing?: Snippet;
    /** Interactive marks after the name button (links, popovers). */
    actions?: Snippet;
    /** Optional second line (reason, details). */
    below?: Snippet;
    class?: string;
  } = $props();

  let dim = $derived(attention === "closed" || attention === "creating" || wt.archived);
</script>

<div
  class="group relative rounded-md {selected ? 'bg-active shadow-[inset_2px_0_0_var(--color-accent)]' : 'hover:bg-hover'} {className}"
  data-key={key}
>
  <div class="flex min-h-7 items-center">
    <button
      type="button"
      role="option"
      aria-selected={selected}
      class="flex min-h-7 min-w-0 flex-1 cursor-pointer items-center gap-1.5 pr-1 text-left text-[13px]"
      style="padding-left:{6 + depth * 14}px"
      title={wt.label ? `${wt.label}\n${wt.branch}` : wt.branch}
      onclick={onselect}
      oncontextmenu={onmenu}
    >
      <StatusGlyph {attention} />
      <span class="min-w-0 flex-1 truncate {dim ? 'text-muted' : ''} {attention === 'creating' ? 'italic' : ''}">{displayName(wt)}</span>
      {#if favorite}<span class="shrink-0 text-[10px] text-warning/80" title="Pinned">★</span>{/if}
      {@render trailing?.()}
    </button>
    {@render actions?.()}
    {#if selected}
      <IconBtn icon="more" label="Actions for {wt.branch}" class="mr-0.5" onclick={onmenu} />
    {/if}
  </div>
  {#if below}
    <div class="pr-2 pb-1.5 [&:not(:has(*))]:hidden" style="padding-left:{28 + depth * 14}px">{@render below()}</div>
  {/if}
</div>
