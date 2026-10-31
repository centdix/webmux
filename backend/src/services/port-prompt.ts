export function buildPortRegistrationSystemPrompt(): string {
  return [
    "Before starting a server that listens on a port, get the port from webmux so it can't collide with another worktree's servers and shows up in the dashboard: `webmux port <label>` prints a free port for a short label of your choice (`web`, `api`, ...), e.g. `PORT=$(webmux port web) bun run dev`. Asking again with the same label returns the same port.",
    "- If the tool picks its own port and can't be told one, register it once it's listening: `webmux port web --port 5173`.",
    "- `webmux port ls` lists this worktree's ports; `webmux port rm <label>` releases one. A port nothing has listened on for 5 minutes is released automatically.",
  ].join("\n");
}
