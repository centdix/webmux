import type { NotificationListener, NotificationEvent, RuntimeNotification } from "./notification-service";

/** One project's notifications, as seen by the hub. `NotificationService`
 *  satisfies it structurally. */
export interface NotificationSource {
  readonly project: string;
  list(): RuntimeNotification[];
  subscribe(listener: NotificationListener): () => void;
}

/** Events sent to a hub client: the per-project events plus `initial`, the
 *  notifications that already existed when the client (or source) arrived. */
export type NotificationHubEvent =
  | NotificationEvent
  | { event: "initial"; data: RuntimeNotification };

export type NotificationHubClient = (event: NotificationHubEvent) => void;

/** Merges the notification streams of every project into one fan-out. The hub
 *  holds a single subscription per source (dropped on `removeSource`), so
 *  clients never subscribe to sources directly and can't leak listeners there. */
export class NotificationHub {
  private readonly sources = new Map<string, { source: NotificationSource; unsubscribe: () => void }>();
  private readonly clients = new Set<NotificationHubClient>();

  /** `keepaliveMs`: interval of the SSE `: ping` comment that keeps quiet
   *  streams under Bun's idle timeout (a reconnect would replay every `initial`). */
  constructor(private readonly keepaliveMs = 30_000) {}

  addSource(source: NotificationSource): void {
    this.removeSource(source.project);
    const unsubscribe = source.subscribe((event) => this.broadcast(event));
    this.sources.set(source.project, { source, unsubscribe });
    for (const notification of source.list()) {
      this.broadcast({ event: "initial", data: notification });
    }
  }

  /** Drop a source; connected clients get a `dismiss` for each of its
   *  notifications so none outlive the project (a re-added project restarts ids). */
  removeSource(project: string): void {
    const entry = this.sources.get(project);
    if (!entry) return;
    entry.unsubscribe();
    this.sources.delete(project);
    for (const { id } of entry.source.list()) {
      this.broadcast({ event: "dismiss", data: { project, id } });
    }
  }

  /** Register a client: it first receives every existing notification as
   *  `initial`, then live events from all sources. Returns the unsubscribe. */
  subscribe(client: NotificationHubClient): () => void {
    for (const { source } of this.sources.values()) {
      for (const notification of source.list()) {
        client({ event: "initial", data: notification });
      }
    }
    this.clients.add(client);
    return () => {
      this.clients.delete(client);
    };
  }

  clientCount(): number {
    return this.clients.size;
  }

  /** SSE response over `subscribe`; the client is dropped when the stream is
   *  cancelled (browser disconnect) or can no longer be written to. */
  stream(): Response {
    const encoder = new TextEncoder();
    let unsubscribe: (() => void) | null = null;
    let keepalive: ReturnType<typeof setInterval> | null = null;
    const close = (): void => {
      unsubscribe?.();
      if (keepalive) clearInterval(keepalive);
    };
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        const send = (chunk: string): void => {
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            close();
          }
        };
        unsubscribe = this.subscribe(({ event, data }) => send(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        keepalive = setInterval(() => send(": ping\n\n"), this.keepaliveMs);
      },
      cancel: close,
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  private broadcast(event: NotificationHubEvent): void {
    for (const client of this.clients) client(event);
  }
}
