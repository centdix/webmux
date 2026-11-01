<script lang="ts">
  import type { Snippet } from "svelte";
  import { dismissible } from "./dismissible";

  let {
    x,
    y,
    label,
    role = "menu",
    onclose,
    children,
  }: {
    /** Viewport point the menu opens at (kept inside the viewport). */
    x: number;
    y: number;
    /** Shown on top and as the menu's name. */
    label: string;
    role?: "menu" | "dialog";
    onclose: () => void;
    children: Snippet;
  } = $props();

  const MARGIN = 4;
  let left = $state(0);
  let top = $state(0);

  function place(node: HTMLElement): void {
    const rect = node.getBoundingClientRect();
    left = Math.max(MARGIN, Math.min(x, window.innerWidth - rect.width - MARGIN));
    top = Math.max(MARGIN, Math.min(y, window.innerHeight - rect.height - MARGIN));
  }
</script>

<div
  class="fixed z-50 min-w-44 max-w-64 rounded-md border border-edge bg-surface p-1 shadow-lg"
  style="left:{left}px;top:{top}px"
  {role}
  aria-label={label}
  data-popup-menu
  {@attach place}
  {@attach dismissible(onclose)}
>
  <p class="truncate px-2 pt-1 pb-1.5 text-[10px] text-muted">{label}</p>
  {@render children()}
</div>
