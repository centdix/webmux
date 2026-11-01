import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppNotification } from "./types";

vi.mock("./api", () => ({ dismissNotification: vi.fn(async () => {}) }));

import { dismissNotification } from "./api";
import { NotificationCenter } from "./notifications.svelte";

function notification(project: string, id: number, branch = "main"): AppNotification {
  return { id, project, branch, type: "agent_stopped", message: `${project} #${id}`, timestamp: 1 };
}

const originalNotification = globalThis.Notification;

describe("NotificationCenter", () => {
  beforeEach(() => {
    vi.mocked(dismissNotification).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(globalThis, "Notification", { configurable: true, writable: true, value: originalNotification });
  });

  it("keeps two projects' notifications with the same id apart", () => {
    const center = new NotificationCenter();

    center.receive(notification("alpha", 1), false);
    center.receive(notification("beta", 1), false);

    expect(center.toasts.map((toast) => toast.id)).toEqual(["notification:alpha:1", "notification:beta:1"]);
    center.removeDismissed({ project: "alpha", id: 1 });
    expect(center.active.map((n) => n.project)).toEqual(["beta"]);
    expect(center.history).toHaveLength(2);
    expect(center.unreadCount).toBe(2);
  });

  it("dedupes replayed history by project and id", () => {
    const center = new NotificationCenter();

    center.receiveInitial(notification("alpha", 1));
    center.receiveInitial(notification("beta", 1));
    center.receiveInitial(notification("alpha", 1));

    expect(center.history.map((n) => n.project)).toEqual(["beta", "alpha"]);
    expect(center.toasts).toEqual([]);
  });

  it("dismisses a toast through its own project's notification", () => {
    const center = new NotificationCenter();
    center.receive(notification("alpha", 7), false);
    center.receive(notification("beta", 7), false);

    center.dismissToast("notification:beta:7");

    expect(dismissNotification).toHaveBeenCalledWith(notification("beta", 7));
    expect(center.active.map((n) => n.project)).toEqual(["alpha"]);
  });

  it("marks worktrees unread by worktree key unless they are being viewed", () => {
    const center = new NotificationCenter();

    center.receive(notification("alpha", 1, "feat/x"), false);
    center.receive(notification("beta", 2, "feat/x"), true);

    expect([...center.unreadWorktrees]).toEqual(["alpha:feat/x"]);
    center.markRead({ project: "alpha", branch: "feat/x" });
    expect(center.unreadWorktrees.size).toBe(0);
  });

  it("auto-dismisses toasts and tags browser notifications with the project", () => {
    vi.useFakeTimers();
    const shown: Array<{ title: string; tag?: string }> = [];
    class MockNotification {
      static permission = "granted";
      constructor(title: string, options?: NotificationOptions) {
        shown.push({ title, ...(options?.tag ? { tag: options.tag } : {}) });
      }
    }
    Object.defineProperty(globalThis, "Notification", { configurable: true, writable: true, value: MockNotification });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    const center = new NotificationCenter();

    center.receive(notification("alpha", 3), false);
    center.show({ tone: "info", message: "hello" });
    expect(center.toasts).toHaveLength(2);
    vi.advanceTimersByTime(4000);

    expect(center.toasts).toHaveLength(0);
    expect(shown).toEqual([{ title: "alpha #3", tag: "wm-alpha:3" }]);
    Reflect.deleteProperty(document, "hidden");
  });

  it("tells the notification's own project when a toast auto-dismisses", () => {
    vi.useFakeTimers();
    const center = new NotificationCenter();
    center.receive(notification("alpha", 4), false);
    center.receive(notification("beta", 5), false);
    center.receive(notification("beta", 6), false);
    center.dismissToast("notification:beta:5");
    center.removeDismissed({ project: "beta", id: 6 });
    vi.mocked(dismissNotification).mockClear();

    vi.advanceTimersByTime(4000);

    expect(dismissNotification).toHaveBeenCalledTimes(1);
    expect(dismissNotification).toHaveBeenCalledWith(notification("alpha", 4));
    expect(center.active).toEqual([]);
  });
});
