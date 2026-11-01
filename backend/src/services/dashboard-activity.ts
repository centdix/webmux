/** How a project is being looked at, which sets its PR/CI display-sync cadence:
 *  `focused` is the project an open dashboard is showing, `visible` any other
 *  project while a dashboard is open (its sidebar lists every project), and
 *  `idle` means no dashboard has polled recently. */
export type ProjectActivity = "focused" | "visible" | "idle";

/** A dashboard (or its focus on a project) counts as gone after this long
 *  without a poll. The dashboard polls every 5s while in use. */
export const DASHBOARD_ACTIVITY_TIMEOUT_MS = 15_000;
export const FOCUSED_PR_SYNC_INTERVAL_MS = 10_000;
export const VISIBLE_PR_SYNC_INTERVAL_MS = 60_000;
/** Ticks fire a few ms apart from the recorded sync time; without slack a
 *  visible project would sync one tick late every other time. */
const SYNC_DUE_SLACK_MS = 1_000;

export interface DashboardActivityState {
  /** Last dashboard poll, any project; null before the first one. */
  lastSeenAt: number | null;
  /** Last time a dashboard reported each project as focused. Several open
   *  tabs may each focus a different project. */
  focusedAt: ReadonlyMap<string, number>;
}

export function projectActivity(state: DashboardActivityState, prefix: string, now: number): ProjectActivity {
  if (state.lastSeenAt === null || now - state.lastSeenAt >= DASHBOARD_ACTIVITY_TIMEOUT_MS) return "idle";
  const focusedAt = state.focusedAt.get(prefix);
  return focusedAt !== undefined && now - focusedAt < DASHBOARD_ACTIVITY_TIMEOUT_MS ? "focused" : "visible";
}

/** PR display-sync interval for an activity level; null means don't sync. */
export function prSyncIntervalMs(activity: ProjectActivity): number | null {
  switch (activity) {
    case "focused": return FOCUSED_PR_SYNC_INTERVAL_MS;
    case "visible": return VISIBLE_PR_SYNC_INTERVAL_MS;
    case "idle": return null;
  }
}

/** Whether a PR sync is due now, given the project's activity and when its
 *  last gated sync ran (null: never). */
export function isPrSyncDue(activity: ProjectActivity, lastSyncAt: number | null, now: number): boolean {
  const interval = prSyncIntervalMs(activity);
  if (interval === null) return false;
  return lastSyncAt === null || now - lastSyncAt >= interval - SYNC_DUE_SLACK_MS;
}

/** Process-wide record of dashboard polls, fed by the hub worktree listing. */
export class DashboardActivityTracker {
  private lastSeenAt: number | null = null;
  private readonly focusedAt = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  /** A dashboard polled, showing `focus` if given. Expired focuses are
   *  dropped so the map only holds what was focused within the timeout. */
  touch(focus?: string): void {
    const now = this.now();
    this.lastSeenAt = now;
    for (const [prefix, at] of this.focusedAt) {
      if (now - at >= DASHBOARD_ACTIVITY_TIMEOUT_MS) this.focusedAt.delete(prefix);
    }
    if (focus !== undefined) this.focusedAt.set(focus, now);
  }

  activityOf(prefix: string): ProjectActivity {
    return projectActivity({ lastSeenAt: this.lastSeenAt, focusedAt: this.focusedAt }, prefix, this.now());
  }

  /** Gate for one project's PR monitor, ticking at the focused interval: it
   *  lets a tick through when a sync is due for the project's current
   *  activity. A newly focused project therefore syncs on the next tick. */
  prSyncGate(prefix: string): () => boolean {
    let lastSyncAt: number | null = null;
    return (): boolean => {
      const now = this.now();
      if (!isPrSyncDue(this.activityOf(prefix), lastSyncAt, now)) return false;
      lastSyncAt = now;
      return true;
    };
  }
}
