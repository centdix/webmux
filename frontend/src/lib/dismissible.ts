import type { Attachment } from "svelte/attachments";

/** Attach to a popup menu's wrapper (the menu and its trigger): a click or
 *  right-click outside it, or Escape, calls `close`. Clicks are caught in the
 *  capture phase, so one landing anywhere else (another menu's trigger
 *  included) closes it even when a handler stops its propagation. Clicks on
 *  `trigger` are left to its own handler, so it can toggle the menu. */
export function dismissible(close: () => void, trigger: HTMLElement | null = null): Attachment<HTMLElement> {
  return (node) => {
    function handleClick(event: MouseEvent): void {
      const target = event.target;
      if (!(target instanceof Node) || (!node.contains(target) && !trigger?.contains(target))) close();
    }

    function handleKeydown(event: KeyboardEvent): void {
      if (event.key === "Escape") close();
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("contextmenu", handleClick, true);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("contextmenu", handleClick, true);
      document.removeEventListener("keydown", handleKeydown);
    };
  };
}
