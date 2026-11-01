import type { Attachment } from "svelte/attachments";

/** Attach to a popup menu's wrapper (the menu and its trigger): a click
 *  outside it or Escape calls `close`. Clicks are caught in the capture
 *  phase, so one landing anywhere else (another menu's trigger included)
 *  closes it even when a handler stops its propagation. */
export function dismissible(close: () => void): Attachment<HTMLElement> {
  return (node) => {
    function handleClick(event: MouseEvent): void {
      if (!(event.target instanceof Node) || !node.contains(event.target)) close();
    }

    function handleKeydown(event: KeyboardEvent): void {
      if (event.key === "Escape") close();
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeydown);
    };
  };
}
