import type { PortProbe } from "../adapters/port-probe";
import type { PortRegistry } from "../adapters/port-registry";
import {
  bumpRunning,
  expireRegistrations,
  pickFreePort,
  PORT_RANGE_END,
  PORT_RANGE_START,
  sameRegistrationKey,
  type PortRegistration,
  type PortRegistrationKey,
} from "../domain/port-registrations";

export interface RegisteredPort {
  label: string;
  port: number;
}

export interface RegisteredPortStatus extends RegisteredPort {
  running: boolean;
}

export type RegisterPortResult =
  | { ok: true; data: RegisteredPort }
  | { ok: false; reason: "conflict" | "exhausted"; error: string };

export interface PortRegistrationServiceDependencies {
  registry: PortRegistry;
  portProbe: PortProbe;
  canBind: (port: number) => boolean;
  now?: () => number;
}

/** Process-wide owner of agent-registered ports, shared by every project so a
 *  port handed to one worktree is never handed to another. */
export class PortRegistrationService {
  private readonly now: () => number;

  constructor(private readonly deps: PortRegistrationServiceDependencies) {
    this.now = deps.now ?? Date.now;
    // Restart grace: while webmux was down nothing bumped these, so restart every
    // TTL from now instead of wiping registrations whose servers are still up.
    const startedAt = this.now();
    const entries = deps.registry.list();
    if (entries.length > 0) {
      deps.registry.replaceAll(entries.map((entry) => ({ ...entry, lastSeenRunningAt: startedAt })));
    }
  }

  register(key: PortRegistrationKey, requestedPort?: number): RegisterPortResult {
    const entries = this.deps.registry.list();
    const existing = entries.find((entry) => sameRegistrationKey(entry, key));
    if (existing && (requestedPort === undefined || requestedPort === existing.port)) {
      return { ok: true, data: { label: existing.label, port: existing.port } };
    }

    const others = entries.filter((entry) => !sameRegistrationKey(entry, key));
    let port: number;
    if (requestedPort !== undefined) {
      const holder = others.find((entry) => entry.port === requestedPort);
      if (holder) {
        return { ok: false, reason: "conflict", error: `Port ${requestedPort} is already registered as "${holder.label}" by another worktree` };
      }
      port = requestedPort;
    } else {
      const picked = pickFreePort({
        start: PORT_RANGE_START,
        end: PORT_RANGE_END,
        taken: new Set(others.map((entry) => entry.port)),
        canBind: this.deps.canBind,
      });
      if (picked === null) {
        return { ok: false, reason: "exhausted", error: `No free port in ${PORT_RANGE_START}-${PORT_RANGE_END}` };
      }
      port = picked;
    }

    const now = this.now();
    const registration: PortRegistration = { ...key, port, registeredAt: now, lastSeenRunningAt: now };
    this.deps.registry.replaceAll([...others, registration]);
    return { ok: true, data: { label: key.label, port } };
  }

  unregister(key: PortRegistrationKey): boolean {
    const entries = this.deps.registry.list();
    const next = entries.filter((entry) => !sameRegistrationKey(entry, key));
    if (next.length === entries.length) return false;
    this.deps.registry.replaceAll(next);
    return true;
  }

  list(projectDir: string, worktreeId: string): RegisteredPort[] {
    return this.deps.registry.list()
      .filter((entry) => entry.projectDir === projectDir && entry.worktreeId === worktreeId)
      .map((entry) => ({ label: entry.label, port: entry.port }));
  }

  async listWithStatus(projectDir: string, worktreeId: string): Promise<RegisteredPortStatus[]> {
    return Promise.all(this.list(projectDir, worktreeId).map(async (entry) => ({
      ...entry,
      running: await this.deps.portProbe.isListening(entry.port),
    })));
  }

  /** Bump every registration that is listening and drop those idle past the TTL. */
  async sweep(): Promise<void> {
    const ports = [...new Set(this.deps.registry.list().map((entry) => entry.port))];
    const running = new Set<number>();
    await Promise.all(ports.map(async (port) => {
      if (await this.deps.portProbe.isListening(port)) running.add(port);
    }));

    // Re-read after the probes so a registration made meanwhile isn't lost.
    const entries = this.deps.registry.list();
    const next = expireRegistrations(bumpRunning(entries, running, this.now()), this.now());
    if (entries.length > 0) this.deps.registry.replaceAll(next);
  }
}
