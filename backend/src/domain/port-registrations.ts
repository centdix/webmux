/** A port an agent registered for a worktree with `webmux port <label>`, persisted
 *  in `~/.webmux/ports.json`. It lives only as long as something keeps listening on
 *  it: `lastSeenRunningAt` starts at registration time and is bumped by every sweep
 *  that finds the port listening; entries idle past the TTL are dropped. */
export interface PortRegistration {
  projectDir: string;
  worktreeId: string;
  label: string;
  port: number;
  registeredAt: number;
  lastSeenRunningAt: number;
}

export interface PortRegistrationKey {
  projectDir: string;
  worktreeId: string;
  label: string;
}

export const PORT_RANGE_START = 4100;
export const PORT_RANGE_END = 4999;
export const PORT_REGISTRATION_TTL_MS = 5 * 60_000;

const PORT_LABEL_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const RESERVED_PORT_LABELS = new Set(["ls", "rm"]);

export function isValidPortLabel(label: string): boolean {
  return PORT_LABEL_PATTERN.test(label) && !RESERVED_PORT_LABELS.has(label);
}

export function isPortRegistration(value: unknown): value is PortRegistration {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.projectDir === "string"
    && typeof v.worktreeId === "string"
    && typeof v.label === "string"
    && typeof v.port === "number"
    && Number.isInteger(v.port)
    && typeof v.registeredAt === "number"
    && typeof v.lastSeenRunningAt === "number";
}

export function sameRegistrationKey(entry: PortRegistrationKey, key: PortRegistrationKey): boolean {
  return entry.projectDir === key.projectDir
    && entry.worktreeId === key.worktreeId
    && entry.label === key.label;
}

/** Lowest port in `[start, end]` that no registration holds and that can be bound. */
export function pickFreePort(input: {
  start: number;
  end: number;
  taken: ReadonlySet<number>;
  canBind: (port: number) => boolean;
}): number | null {
  for (let port = input.start; port <= input.end; port++) {
    if (input.taken.has(port)) continue;
    if (input.canBind(port)) return port;
  }
  return null;
}

export function bumpRunning(
  entries: PortRegistration[],
  runningPorts: ReadonlySet<number>,
  now: number,
): PortRegistration[] {
  return entries.map((entry) => runningPorts.has(entry.port) ? { ...entry, lastSeenRunningAt: now } : entry);
}

export function expireRegistrations(
  entries: PortRegistration[],
  now: number,
  ttlMs: number = PORT_REGISTRATION_TTL_MS,
): PortRegistration[] {
  return entries.filter((entry) => now - entry.lastSeenRunningAt <= ttlMs);
}
