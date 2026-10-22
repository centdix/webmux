/** Apply a `.env` file's text to `env`, returning every key the file defines.
 *  An already-set value wins (the shell, the service unit, or a file loaded
 *  earlier), but its key is still returned: Bun auto-loads `.env` from CWD
 *  before webmux runs, so the launch project's keys are usually present by the
 *  time we read the file, and they must still be reported so the backend keeps
 *  them out of the tmux server's global environment (WEBMUX_PROJECT_ENV_KEYS). */
export function applyEnvText(text: string, env: Record<string, string | undefined>): string[] {
  const keys: string[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in env)) env[key] = val;
    keys.push(key);
  }
  return keys;
}
