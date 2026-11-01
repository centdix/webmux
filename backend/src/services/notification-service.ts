import type { NotificationDismissal } from "@webmux/api-contract";
import type { RuntimeEvent } from "../domain/events";

export interface RuntimeNotification {
  id: number;
  project: string;
  branch: string;
  type: "agent_stopped" | "pr_opened" | "runtime_error" | "worktree_auto_removed";
  message: string;
  url?: string;
  timestamp: number;
}

export type NotificationEvent =
  | { event: "notification"; data: RuntimeNotification }
  | { event: "dismiss"; data: NotificationDismissal };

export type NotificationListener = (event: NotificationEvent) => void;

function eventToNotificationInput(event: RuntimeEvent): { branch: string; type: RuntimeNotification["type"]; message: string; url?: string } | null {
  switch (event.type) {
    case "agent_stopped":
      return { branch: event.branch, type: "agent_stopped", message: `Agent stopped on ${event.branch}` };
    case "pr_opened":
      return { branch: event.branch, type: "pr_opened", message: `PR opened on ${event.branch}`, url: event.url };
    case "runtime_error":
      return { branch: event.branch, type: "runtime_error", message: `Runtime error on ${event.branch}: ${event.message}` };
    default:
      return null;
  }
}

export class NotificationService {
  private readonly notifications: RuntimeNotification[] = [];
  private readonly listeners = new Set<NotificationListener>();
  private nextId = 1;

  /** `project` is the prefix stamped on every notification so merged streams
   *  can tell projects apart (ids are only unique per project). */
  constructor(readonly project: string, private readonly maxItems = 50) {}

  list(): RuntimeNotification[] {
    return [...this.notifications];
  }

  subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dismiss(id: number): boolean {
    const index = this.notifications.findIndex((notification) => notification.id === id);
    if (index === -1) return false;
    this.notifications.splice(index, 1);
    this.emit({ event: "dismiss", data: { project: this.project, id } });
    return true;
  }

  notify(input: { branch: string; type: RuntimeNotification["type"]; message: string; url?: string }): RuntimeNotification {
    const notification: RuntimeNotification = {
      id: this.nextId,
      project: this.project,
      branch: input.branch,
      type: input.type,
      message: input.message,
      ...(input.url ? { url: input.url } : {}),
      timestamp: Date.now(),
    };
    this.nextId += 1;
    this.notifications.push(notification);
    while (this.notifications.length > this.maxItems) {
      this.notifications.shift();
    }
    this.emit({ event: "notification", data: notification });
    return notification;
  }

  recordEvent(event: RuntimeEvent): RuntimeNotification | null {
    const input = eventToNotificationInput(event);
    if (!input) return null;
    return this.notify(input);
  }

  private emit(event: NotificationEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
