<script module lang="ts">
  /** Context a `menu` sets: its MenuItems take the `menuitem` role. */
  export const IN_MENU = Symbol("in-menu");
</script>

<script lang="ts">
  import { setContext, type Snippet } from "svelte";
  import { dismissible } from "./dismissible";

  let {
    x,
    y,
    label,
    role = "menu",
    trigger = null,
    onclose,
    children,
  }: {
    /** Viewport point the menu opens at (kept inside the viewport). */
    x: number;
    y: number;
    /** Shown on top and as the menu's name. */
    label: string;
    role?: "menu" | "dialog";
    /** What opened it: focus goes back to it when the menu closes from inside,
     *  and clicks on it are left to its own handler (to toggle the menu). */
    trigger?: HTMLElement | null;
    onclose: () => void;
    children: Snippet;
  } = $props();

  setContext(IN_MENU, () => role === "menu");

  const MARGIN = 4;
  let left = $state(0);
  let top = $state(0);

  function place(node: HTMLElement): () => void {
    function clamp(): void {
      const rect = node.getBoundingClientRect();
      left = Math.max(MARGIN, Math.min(x, window.innerWidth - rect.width - MARGIN));
      top = Math.max(MARGIN, Math.min(y, window.innerHeight - rect.height - MARGIN));
    }
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }

  function menuItems(node: HTMLElement): HTMLElement[] {
    return Array.from(node.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'));
  }

  /** Focus the first item; closing with the focus inside (Escape, an item)
   *  gives it back to the trigger. */
  function manageFocus(node: HTMLElement): () => void {
    let focusInside = false;
    function handleFocusIn(): void {
      focusInside = true;
    }
    function handleFocusOut(event: FocusEvent): void {
      focusInside = event.relatedTarget instanceof Node && node.contains(event.relatedTarget);
    }
    node.addEventListener("focusin", handleFocusIn);
    node.addEventListener("focusout", handleFocusOut);
    menuItems(node)[0]?.focus();
    return () => {
      node.removeEventListener("focusin", handleFocusIn);
      node.removeEventListener("focusout", handleFocusOut);
      const active = document.activeElement;
      if (focusInside && (!active || active === document.body || node.contains(active))) trigger?.focus();
    };
  }

  function handleKeydown(event: KeyboardEvent & { currentTarget: HTMLElement }): void {
    const items = menuItems(event.currentTarget);
    const index = document.activeElement instanceof HTMLElement ? items.indexOf(document.activeElement) : -1;
    const next =
      event.key === "ArrowDown" ? items[(index + 1) % items.length]
      : event.key === "ArrowUp" ? items[index <= 0 ? items.length - 1 : index - 1]
      : event.key === "Home" ? items[0]
      : event.key === "End" ? items.at(-1)
      : undefined;
    if (!next) return;
    event.preventDefault();
    next.focus();
  }
</script>

<div
  class="fixed z-50 min-w-44 max-w-64 rounded-md border border-edge bg-surface p-1 shadow-lg"
  style="left:{left}px;top:{top}px"
  {role}
  aria-label={label}
  tabindex="-1"
  data-popup-menu
  onkeydown={handleKeydown}
  {@attach place}
  {@attach manageFocus}
  {@attach dismissible(onclose, trigger)}
>
  <p class="truncate px-2 pt-1 pb-1.5 text-[10px] text-muted" role="presentation">{label}</p>
  {@render children()}
</div>
