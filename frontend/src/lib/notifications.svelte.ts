import { SvelteSet } from "svelte/reactivity";
import { dismissNotification } from "./api";
import type {
  AppNotification,
  NotificationDismissal,
  NotificationToastItem,
  ToastInput,
  ToastItem,
  ToastTone,
  UiToastItem,
  WorktreeRef,
} from "./types";
import { notificationKey, worktreeKey } from "./worktree-ref";

const AUTO_DISMISS_MS = 4000;
const MAX_HISTORY = 10;

function notificationTone(notification: AppNotification): ToastTone {
  if (notification.type === "runtime_error") return "error";
  if (notification.type === "agent_stopped" || notification.type === "worktree_auto_removed") return "success";
  return "info";
}

export function notificationToast(notification: AppNotification): NotificationToastItem {
  return {
    id: `notification:${notificationKey(notification)}`,
    source: "notification",
    notification,
    tone: notificationTone(notification),
    message: notification.message,
    ...(notification.url ? { url: notification.url } : {}),
    branch: notification.branch,
  };
}

function withoutNotification(list: AppNotification[], target: Pick<AppNotification, "project" | "id">): AppNotification[] {
  const key = notificationKey(target);
  return list.filter((notification) => notificationKey(notification) !== key);
}

/** Notifications of every project (toasts, bell history, unread worktrees) and
 *  UI toasts. Notification ids are only unique per project, so everything is
 *  keyed by project + id. */
export class NotificationCenter {
  /** Live notifications shown as toasts until dismissed or timed out. */
  active = $state<AppNotification[]>([]);
  history = $state<AppNotification[]>([]);
  unreadCount = $state(0);
  /** `worktreeKey`s with a notification the user hasn't looked at yet. */
  readonly unreadWorktrees = new SvelteSet<string>();
  uiToasts = $state<UiToastItem[]>([]);
  readonly toasts: ToastItem[] = $derived([...this.active.map(notificationToast), ...this.uiToasts]);
  #nextToastId = 0;
  /** `notificationKey`s received this session, so a replay on stream
   *  reconnect leaves the bell as it is. */
  readonly #seen = new Set<string>();

  /** `viewing`: the user is looking at that worktree right now, so it doesn't
   *  get an unread mark. */
  receive(notification: AppNotification, viewing: boolean): void {
    this.#seen.add(notificationKey(notification));
    this.active = [...this.active, notification];
    if (!viewing) this.unreadWorktrees.add(worktreeKey(notification));
    this.history = [notification, ...this.history].slice(0, MAX_HISTORY);
    this.unreadCount++;
    setTimeout(() => {
      this.active = withoutNotification(this.active, notification);
    }, AUTO_DISMISS_MS);
    if (document.hidden && Notification.permission === "granted") {
      new Notification(notification.message, {
        body: notification.url ?? notification.branch,
        tag: `wm-${notificationKey(notification)}`,
      });
    }
  }

  /** Replayed history on (re)connect: fills the bell without toasting. */
  receiveInitial(notification: AppNotification): void {
    const key = notificationKey(notification);
    if (this.#seen.has(key)) return;
    this.#seen.add(key);
    this.history = [notification, ...this.history].slice(0, MAX_HISTORY);
  }

  /** Dismissed elsewhere (another tab, the CLI). */
  removeDismissed(dismissal: NotificationDismissal): void {
    this.active = withoutNotification(this.active, dismissal);
  }

  dismiss(notification: AppNotification): void {
    this.active = withoutNotification(this.active, notification);
    dismissNotification(notification).catch(() => {});
  }

  markRead(ref: WorktreeRef): void {
    this.unreadWorktrees.delete(worktreeKey(ref));
  }

  markAllSeen(): void {
    this.unreadCount = 0;
  }

  show(toast: ToastInput): void {
    const id = `ui:${this.#nextToastId++}`;
    this.uiToasts = [...this.uiToasts, { id, source: "ui", ...toast }];
    setTimeout(() => {
      this.uiToasts = this.uiToasts.filter((item) => item.id !== id);
    }, AUTO_DISMISS_MS);
  }

  findToast(id: string): ToastItem | undefined {
    return this.toasts.find((item) => item.id === id);
  }

  dismissToast(id: string): void {
    const toast = this.findToast(id);
    if (!toast) return;
    if (toast.source === "notification") {
      this.dismiss(toast.notification);
      return;
    }
    this.uiToasts = this.uiToasts.filter((item) => item.id !== id);
  }
}
