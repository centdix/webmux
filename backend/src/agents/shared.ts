export interface StampedSession {
  sessionId: string;
  mtimeMs: number;
}

export function home(): string {
  const value = Bun.env.HOME;
  if (!value) throw new Error("HOME is required to resolve agent sessions");
  return value;
}

export function newestFirst(sessions: StampedSession[]): string[] {
  return sessions.sort((left, right) => right.mtimeMs - left.mtimeMs).map((entry) => entry.sessionId);
}

export function quoteShell(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
