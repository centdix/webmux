import { describe, expect, it } from "bun:test";
import {
  DASHBOARD_ACTIVITY_TIMEOUT_MS,
  DashboardActivityTracker,
  FOCUSED_PR_SYNC_INTERVAL_MS,
  VISIBLE_PR_SYNC_INTERVAL_MS,
  isPrSyncDue,
  projectActivity,
  prSyncIntervalMs,
} from "../services/dashboard-activity";

describe("projectActivity", () => {
  const state = { lastSeenAt: 1_000, focusedAt: new Map([["a", 1_000]]) };

  it("is idle before any dashboard poll", () => {
    expect(projectActivity({ lastSeenAt: null, focusedAt: new Map() }, "a", 0)).toBe("idle");
  });

  it("marks the focused project focused and the others visible", () => {
    expect(projectActivity(state, "a", 2_000)).toBe("focused");
    expect(projectActivity(state, "b", 2_000)).toBe("visible");
  });

  it("goes idle for every project once the dashboard stops polling", () => {
    const later = 1_000 + DASHBOARD_ACTIVITY_TIMEOUT_MS;
    expect(projectActivity(state, "a", later)).toBe("idle");
    expect(projectActivity(state, "b", later)).toBe("idle");
  });

  it("demotes a project whose focus expired while the dashboard is still polling", () => {
    const later = 1_000 + DASHBOARD_ACTIVITY_TIMEOUT_MS;
    expect(projectActivity({ ...state, lastSeenAt: later }, "a", later)).toBe("visible");
  });
});

describe("prSyncIntervalMs", () => {
  it("is fast when focused, slow when visible and off when idle", () => {
    expect(prSyncIntervalMs("focused")).toBe(FOCUSED_PR_SYNC_INTERVAL_MS);
    expect(prSyncIntervalMs("visible")).toBe(VISIBLE_PR_SYNC_INTERVAL_MS);
    expect(prSyncIntervalMs("idle")).toBeNull();
  });
});

describe("isPrSyncDue", () => {
  it("never syncs an idle project", () => {
    expect(isPrSyncDue("idle", null, 0)).toBe(false);
  });

  it("syncs right away when nothing ran yet", () => {
    expect(isPrSyncDue("visible", null, 0)).toBe(true);
  });

  it("waits a full interval, tolerating tick jitter", () => {
    expect(isPrSyncDue("visible", 0, FOCUSED_PR_SYNC_INTERVAL_MS)).toBe(false);
    expect(isPrSyncDue("visible", 0, VISIBLE_PR_SYNC_INTERVAL_MS - 5)).toBe(true);
    expect(isPrSyncDue("focused", 0, FOCUSED_PR_SYNC_INTERVAL_MS - 5)).toBe(true);
  });
});

describe("DashboardActivityTracker", () => {
  function setup(): { tracker: DashboardActivityTracker; advance: (ms: number) => void } {
    let now = 0;
    return { tracker: new DashboardActivityTracker(() => now), advance: (ms) => { now += ms; } };
  }

  /** Tick both gates at the focused interval for `ticks` ticks, recording which
   *  projects synced on each. The dashboard keeps polling with `focus`. */
  function runTicks(
    tracker: DashboardActivityTracker,
    advance: (ms: number) => void,
    gates: Record<string, () => boolean>,
    focus: string,
    ticks: number,
  ): string[][] {
    const synced: string[][] = [];
    for (let i = 0; i < ticks; i++) {
      tracker.touch(focus);
      synced.push(Object.entries(gates).filter(([, gate]) => gate()).map(([prefix]) => prefix));
      advance(FOCUSED_PR_SYNC_INTERVAL_MS);
    }
    return synced;
  }

  it("does not sync anything without a dashboard poll", () => {
    const { tracker } = setup();
    expect(tracker.activityOf("a")).toBe("idle");
    expect(tracker.prSyncGate("a")()).toBe(false);
  });

  it("syncs the focused project every tick and the others every minute", () => {
    const { tracker, advance } = setup();
    const gates = { a: tracker.prSyncGate("a"), b: tracker.prSyncGate("b") };
    const synced = runTicks(tracker, advance, gates, "a", 7);
    expect(synced.filter((s) => s.includes("a"))).toHaveLength(7);
    expect(synced.map((s) => s.includes("b"))).toEqual([true, false, false, false, false, false, true]);
  });

  it("speeds the newly focused project up on the next tick and slows the old one down", () => {
    const { tracker, advance } = setup();
    const gates = { a: tracker.prSyncGate("a"), b: tracker.prSyncGate("b") };
    runTicks(tracker, advance, gates, "a", 2);

    // b last synced 20s ago as a visible project; focusing it syncs it right away.
    const afterSwitch = runTicks(tracker, advance, gates, "b", 12);
    expect(afterSwitch.every((s) => s.includes("b"))).toBe(true);
    // a's focus has not expired on the switch tick; after that it syncs once a minute.
    const aSyncs = afterSwitch.flatMap((s, i) => (s.includes("a") ? [i] : []));
    expect(aSyncs).toEqual([0, 6]);
  });

  it("goes idle once the dashboard stops polling", () => {
    const { tracker, advance } = setup();
    const gate = tracker.prSyncGate("a");
    tracker.touch("a");
    expect(gate()).toBe(true);
    advance(DASHBOARD_ACTIVITY_TIMEOUT_MS);
    expect(tracker.activityOf("a")).toBe("idle");
    expect(gate()).toBe(false);
  });

  it("keeps every tab's focus when several dashboards focus different projects", () => {
    const { tracker, advance } = setup();
    tracker.touch("a");
    advance(1_000);
    tracker.touch("b");
    expect(tracker.activityOf("a")).toBe("focused");
    expect(tracker.activityOf("b")).toBe("focused");
    expect(tracker.activityOf("c")).toBe("visible");
  });
});
