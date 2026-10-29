import { describe, expect, it } from "bun:test";
import type { PortRegistry } from "../adapters/port-registry";
import { PORT_REGISTRATION_TTL_MS, type PortRegistration } from "../domain/port-registrations";
import { PortRegistrationService } from "../services/port-registration-service";

function memoryRegistry(initial: PortRegistration[] = []): PortRegistry & { entries: PortRegistration[] } {
  const registry = {
    entries: initial,
    list: (): PortRegistration[] => registry.entries.map((entry) => ({ ...entry })),
    replaceAll: (entries: PortRegistration[]): void => {
      registry.entries = entries;
    },
  };
  return registry;
}

function makeService(options: {
  registry?: ReturnType<typeof memoryRegistry>;
  listening?: Set<number>;
  unbindable?: Set<number>;
  clock?: { now: number };
} = {}): { service: PortRegistrationService; registry: ReturnType<typeof memoryRegistry>; clock: { now: number } } {
  const registry = options.registry ?? memoryRegistry();
  const listening = options.listening ?? new Set<number>();
  const unbindable = options.unbindable ?? new Set<number>();
  const clock = options.clock ?? { now: 1_000 };
  const service = new PortRegistrationService({
    registry,
    portProbe: { isListening: async (port) => listening.has(port) },
    canBind: (port) => !unbindable.has(port),
    now: () => clock.now,
  });
  return { service, registry, clock };
}

const web = { projectDir: "/repo-a", worktreeId: "wt-1", label: "web" };

describe("PortRegistrationService.register", () => {
  it("allocates the lowest free port and returns it again for the same label", () => {
    const { service } = makeService({ unbindable: new Set([4100]) });
    expect(service.register(web)).toEqual({ ok: true, data: { label: "web", port: 4101 } });
    expect(service.register(web)).toEqual({ ok: true, data: { label: "web", port: 4101 } });
    expect(service.register({ ...web, label: "api" })).toEqual({ ok: true, data: { label: "api", port: 4102 } });
  });

  it("never hands out a port registered by another project's worktree", () => {
    const { service } = makeService();
    service.register(web);
    expect(service.register({ projectDir: "/repo-b", worktreeId: "wt-9", label: "web" }))
      .toEqual({ ok: true, data: { label: "web", port: 4101 } });
  });

  it("registers an explicit port without a bind check, and rejects one held elsewhere", () => {
    const { service } = makeService({ unbindable: new Set([5173]) });
    expect(service.register(web, 5173)).toEqual({ ok: true, data: { label: "web", port: 5173 } });
    const other = service.register({ ...web, worktreeId: "wt-2" }, 5173);
    expect(other.ok).toBe(false);
    if (!other.ok) expect(other.reason).toBe("conflict");
  });

  it("moves an existing label to a newly requested port", () => {
    const { service } = makeService();
    service.register(web);
    expect(service.register(web, 5173)).toEqual({ ok: true, data: { label: "web", port: 5173 } });
    expect(service.list("/repo-a", "wt-1")).toEqual([{ label: "web", port: 5173 }]);
  });
});

describe("PortRegistrationService.sweep", () => {
  it("keeps listening registrations and drops ones idle past the TTL", async () => {
    const listening = new Set<number>();
    const { service, clock } = makeService({ listening });
    service.register(web);
    service.register({ ...web, label: "api" });
    listening.add(4100);

    clock.now += PORT_REGISTRATION_TTL_MS + 1;
    await service.sweep();
    expect(service.list("/repo-a", "wt-1")).toEqual([{ label: "web", port: 4100 }]);
  });

  it("restarts every TTL on startup so a webmux restart doesn't wipe registrations", async () => {
    const registry = memoryRegistry([{ ...web, port: 4100, registeredAt: 0, lastSeenRunningAt: 0 }]);
    const clock = { now: PORT_REGISTRATION_TTL_MS * 10 };
    const { service } = makeService({ registry, clock });
    await service.sweep();
    expect(service.list("/repo-a", "wt-1")).toEqual([{ label: "web", port: 4100 }]);
  });
});

describe("PortRegistrationService.unregister", () => {
  it("removes only the matching label", () => {
    const { service } = makeService();
    service.register(web);
    service.register({ ...web, label: "api" });
    expect(service.unregister(web)).toBe(true);
    expect(service.unregister(web)).toBe(false);
    expect(service.list("/repo-a", "wt-1")).toEqual([{ label: "api", port: 4101 }]);
  });
});
