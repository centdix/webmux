import type { Attachment } from "svelte/attachments";

/** Attach to a popup menu: a click outside it or Escape calls `close`. Its
 *  trigger must stop the opening click's propagation. */
export function dismissible(close: () => void): Attachment<HTMLElement> {
  return (node) => {
    function handleClick(event: MouseEvent): void {
      if (!(event.target instanceof Node) || !node.contains(event.target)) close();
    }

    function handleKeydown(event: KeyboardEvent): void {
      if (event.key === "Escape") close();
    }

    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeydown);
    };
  };
}
