import { describe, expect, it } from "bun:test";
import {
  bumpRunning,
  expireRegistrations,
  isValidPortLabel,
  parsePortRegistration,
  pickFreePort,
  PORT_REGISTRATION_TTL_MS,
  releaseWorktreeRegistrations,
  type PortRegistration,
} from "../domain/port-registrations";

function makeEntry(overrides: Partial<PortRegistration> = {}): PortRegistration {
  return {
    projectDir: "/repo",
    worktreeId: "wt-1",
    label: "web",
    port: 4100,
    registeredAt: 0,
    lastSeenRunningAt: 0,
    keep: false,
    ...overrides,
  };
}

describe("pickFreePort", () => {
  it("returns the lowest port that is neither taken nor bound", () => {
    expect(pickFreePort({
      start: 4100,
      end: 4110,
      taken: new Set([4100]),
      canBind: (port) => port !== 4101,
    })).toBe(4102);
  });

  it("returns null when the range is exhausted", () => {
    expect(pickFreePort({ start: 4100, end: 4101, taken: new Set([4100]), canBind: () => false })).toBeNull();
  });
});

describe("isValidPortLabel", () => {
  it("accepts short lowercase labels and rejects reserved or malformed ones", () => {
    expect(isValidPortLabel("web")).toBe(true);
    expect(isValidPortLabel("api-2")).toBe(true);
    expect(isValidPortLabel("ls")).toBe(false);
    expect(isValidPortLabel("rm")).toBe(false);
    expect(isValidPortLabel("Web")).toBe(false);
    expect(isValidPortLabel("-web")).toBe(false);
    expect(isValidPortLabel("")).toBe(false);
  });
});

describe("bumpRunning / expireRegistrations", () => {
  it("bumps only listening ports", () => {
    const entries = [makeEntry({ port: 4100 }), makeEntry({ label: "api", port: 4101 })];
    expect(bumpRunning(entries, new Set([4101]), 500).map((entry) => entry.lastSeenRunningAt)).toEqual([0, 500]);
  });

  it("drops registrations idle past the TTL", () => {
    const entries = [
      makeEntry({ lastSeenRunningAt: 0 }),
      makeEntry({ label: "api", lastSeenRunningAt: 1 }),
    ];
    expect(expireRegistrations(entries, PORT_REGISTRATION_TTL_MS + 1).map((entry) => entry.label)).toEqual(["api"]);
  });

  it("never expires kept registrations", () => {
    const entries = [
      makeEntry({ lastSeenRunningAt: 0, keep: true }),
      makeEntry({ label: "api", lastSeenRunningAt: 0 }),
    ];
    expect(expireRegistrations(entries, PORT_REGISTRATION_TTL_MS * 100).map((entry) => entry.label)).toEqual(["web"]);
  });
});

describe("parsePortRegistration", () => {
  it("loads entries written before keep existed as not kept", () => {
    const { keep: _keep, ...legacy } = makeEntry();
    expect(parsePortRegistration(legacy)).toEqual(makeEntry({ keep: false }));
    expect(parsePortRegistration(makeEntry({ keep: true }))?.keep).toBe(true);
  });

  it("rejects malformed entries", () => {
    expect(parsePortRegistration(null)).toBeNull();
    expect(parsePortRegistration({ ...makeEntry(), port: "4100" })).toBeNull();
  });
});

describe("releaseWorktreeRegistrations", () => {
  it("drops every entry of the worktree, kept ones included, and nothing else", () => {
    const entries = [
      makeEntry({ label: "web" }),
      makeEntry({ label: "api", keep: true }),
      makeEntry({ worktreeId: "wt-2" }),
      makeEntry({ projectDir: "/other" }),
    ];
    expect(releaseWorktreeRegistrations(entries, "/repo", "wt-1")).toEqual([
      makeEntry({ worktreeId: "wt-2" }),
      makeEntry({ projectDir: "/other" }),
    ]);
  });
});
