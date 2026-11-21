import type { NotificationDismissal } from "@webmux/api-contract";
import type { RuntimeEvent } from "../domain/events";

export interface RuntimeNotification {
  id: number;
  project: string;
  worktreeId: string;
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

export type NotificationInput = Pick<RuntimeNotification, "worktreeId" | "branch" | "type" | "message" | "url">;

function eventToNotificationInput(event: RuntimeEvent, branch: string): NotificationInput | null {
  const { worktreeId } = event;
  switch (event.type) {
    case "agent_stopped":
      return { worktreeId, branch, type: "agent_stopped", message: `Agent stopped on ${branch}` };
    case "pr_opened":
      return { worktreeId, branch, type: "pr_opened", message: `PR opened on ${branch}`, url: event.url };
    case "runtime_error":
      return { worktreeId, branch, type: "runtime_error", message: `Runtime error on ${branch}: ${event.message}` };
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

  notify(input: NotificationInput): RuntimeNotification {
    const notification: RuntimeNotification = {
      id: this.nextId,
      project: this.project,
      worktreeId: input.worktreeId,
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

  recordEvent(event: RuntimeEvent, branch: string): RuntimeNotification | null {
    const input = eventToNotificationInput(event, branch);
    if (!input) return null;
    return this.notify(input);
  }

  private emit(event: NotificationEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
