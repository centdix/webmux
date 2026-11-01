import { describe, expect, it } from "bun:test";
import { NotificationService, type NotificationEvent } from "../services/notification-service";

describe("NotificationService", () => {
  it("creates notifications only for user-visible runtime events", () => {
    const notifications = new NotificationService("webmux");

    const started = notifications.recordEvent(
      { worktreeId: "wt_search", branch: "feature/search", type: "agent_status_changed", lifecycle: "running" },
    );
    const stopped = notifications.recordEvent(
      { worktreeId: "wt_search", branch: "feature/search", type: "agent_stopped" },
    );

    expect(started).toBeNull();
    expect(stopped?.type).toBe("agent_stopped");
    expect(notifications.list()).toHaveLength(1);
  });

  it("stores pr_opened and runtime_error notifications with details", () => {
    const notifications = new NotificationService("webmux");

    const pr = notifications.recordEvent(
      { worktreeId: "wt_search", branch: "feature/search", type: "pr_opened", url: "https://github.com/org/repo/pull/123" },
    );
    const error = notifications.recordEvent(
      { worktreeId: "wt_search", branch: "feature/search", type: "runtime_error", message: "agent crashed" },
    );

    expect(pr?.url).toBe("https://github.com/org/repo/pull/123");
    expect(error?.message).toContain("agent crashed");
    expect(notifications.list()).toHaveLength(2);
  });

  it("dismisses notifications by id", () => {
    const notifications = new NotificationService("webmux");
    const item = notifications.recordEvent(
      { worktreeId: "wt_search", branch: "feature/search", type: "agent_stopped" },
    );

    expect(item).not.toBeNull();
    expect(notifications.dismiss(item!.id)).toBe(true);
    expect(notifications.list()).toHaveLength(0);
  });

  it("stamps the project prefix on every notification", () => {
    const notifications = new NotificationService("webmux");
    const item = notifications.recordEvent(
      { worktreeId: "wt_search", branch: "feature/search", type: "agent_stopped" },
    );

    expect(item?.project).toBe("webmux");
    expect(notifications.list()[0]?.project).toBe("webmux");
  });

  it("emits live notification and dismiss events to subscribers until unsubscribed", () => {
    const notifications = new NotificationService("webmux");
    const events: NotificationEvent[] = [];
    const unsubscribe = notifications.subscribe((event) => events.push(event));

    const live = notifications.recordEvent(
      { worktreeId: "wt_search", branch: "feature/search", type: "pr_opened", url: "https://github.com/org/repo/pull/123" },
    );
    notifications.dismiss(live!.id);
    unsubscribe();
    notifications.recordEvent({ worktreeId: "wt_search", branch: "feature/search", type: "agent_stopped" });

    expect(events).toEqual([
      { event: "notification", data: live! },
      { event: "dismiss", data: { project: "webmux", id: live!.id } },
    ]);
  });
});
