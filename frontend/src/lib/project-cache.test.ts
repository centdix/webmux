import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectCache } from "./project-cache.svelte";

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("ProjectCache", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads each project once and keeps the values apart", async () => {
    const load = vi.fn(async (project: string) => `config of ${project}`);
    const cache = new ProjectCache(load, { maxAgeMs: Infinity });

    cache.ensure("alpha");
    cache.ensure("beta");
    cache.ensure("alpha");
    await flush();

    expect(load).toHaveBeenCalledTimes(2);
    expect(cache.get("alpha")).toBe("config of alpha");
    expect(cache.get("beta")).toBe("config of beta");
    expect(cache.get("gamma")).toBeUndefined();
  });

  it("reloads after maxAge or an invalidate, and not after a fresh failure", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const load = vi.fn<(project: string) => Promise<number>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(1);
    const cache = new ProjectCache(load, { maxAgeMs: 1000, onError });

    cache.ensure("alpha");
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledWith("alpha", expect.any(Error));
    cache.ensure("alpha");
    expect(load).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    cache.ensure("alpha");
    expect(load).toHaveBeenCalledTimes(2);

    cache.invalidate("alpha");
    cache.ensure("alpha");
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("keeps the newest load when an older one resolves after it", async () => {
    let resolveStale!: (value: string) => void;
    const load = vi.fn<(project: string) => Promise<string>>()
      .mockReturnValueOnce(new Promise((resolve) => (resolveStale = resolve)))
      .mockResolvedValueOnce("fresh");
    const cache = new ProjectCache(load, { maxAgeMs: Infinity });

    cache.ensure("alpha");
    cache.invalidate("alpha");
    cache.ensure("alpha");
    await flush();
    resolveStale("stale");
    await flush();

    expect(cache.get("alpha")).toBe("fresh");
  });

  it("update during an in-flight load wins", async () => {
    let resolveStale!: (value: { agents: number }) => void;
    const load = vi.fn<(project: string) => Promise<{ agents: number }>>()
      .mockResolvedValueOnce({ agents: 1 })
      .mockReturnValueOnce(new Promise((resolve) => (resolveStale = resolve)));
    const cache = new ProjectCache(load, { maxAgeMs: Infinity });

    cache.ensure("alpha");
    await flush();
    cache.invalidate("alpha");
    cache.ensure("alpha");
    cache.update("alpha", () => ({ agents: 5 }));
    resolveStale({ agents: 1 });
    await flush();

    expect(cache.get("alpha")).toEqual({ agents: 5 });
  });

  it("updates a loaded value in place", async () => {
    const cache = new ProjectCache(async () => ({ agents: 1 }), { maxAgeMs: Infinity });
    cache.update("alpha", (value) => ({ agents: value.agents + 1 }));
    expect(cache.get("alpha")).toBeUndefined();

    cache.ensure("alpha");
    await flush();
    cache.update("alpha", (value) => ({ agents: value.agents + 1 }));

    expect(cache.get("alpha")).toEqual({ agents: 2 });
  });

  it("forgets a deleted project, dropping its load in flight", async () => {
    let resolveLoad: (value: string) => void = () => {};
    const load = vi.fn((project: string) =>
      project === "beta" ? new Promise<string>((resolve) => (resolveLoad = resolve)) : Promise.resolve(project),
    );
    const cache = new ProjectCache(load, { maxAgeMs: Infinity });
    cache.ensure("alpha");
    cache.ensure("beta");
    await flush();

    cache.delete("alpha");
    cache.delete("beta");
    resolveLoad("beta");
    await flush();

    expect(cache.get("alpha")).toBeUndefined();
    expect(cache.get("beta")).toBeUndefined();
    cache.ensure("alpha");
    expect(load).toHaveBeenCalledTimes(3);
  });
});
