import { describe, expect, it } from "bun:test";
import { NotificationHub, type NotificationHubEvent } from "../services/notification-hub-service";
import { NotificationService } from "../services/notification-service";

function agentStopped(service: NotificationService, branch: string): void {
  service.recordEvent({ worktreeId: `wt_${branch}`, branch, type: "agent_stopped" });
}

async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const chunk = await reader.read();
  expect(chunk.done).toBe(false);
  return new TextDecoder().decode(chunk.value);
}

describe("NotificationHub", () => {
  it("replays existing notifications of every source as initial, then merges live events", () => {
    const webmux = new NotificationService("webmux");
    const images = new NotificationService("images");
    agentStopped(webmux, "main");
    const hub = new NotificationHub();
    hub.addSource(webmux);
    hub.addSource(images);

    const events: NotificationHubEvent[] = [];
    hub.subscribe((event) => events.push(event));
    agentStopped(images, "feature/a");
    images.dismiss(1);

    expect(events.map(({ event, data }) => [event, data.project, data.id])).toEqual([
      ["initial", "webmux", 1],
      ["notification", "images", 1],
      ["dismiss", "images", 1],
    ]);
  });

  it("forwards sources added after a client connected, starting with their existing notifications", () => {
    const hub = new NotificationHub();
    const events: NotificationHubEvent[] = [];
    hub.subscribe((event) => events.push(event));

    const late = new NotificationService("late");
    agentStopped(late, "main");
    hub.addSource(late);
    agentStopped(late, "feature/b");

    expect(events.map(({ event, data }) => [event, data.project, data.id])).toEqual([
      ["initial", "late", 1],
      ["notification", "late", 2],
    ]);
  });

  it("dismisses a removed source's notifications and stops forwarding it", () => {
    const webmux = new NotificationService("webmux");
    agentStopped(webmux, "main");
    const hub = new NotificationHub();
    hub.addSource(webmux);
    const events: NotificationHubEvent[] = [];
    hub.subscribe((event) => events.push(event));

    hub.removeSource("webmux");
    agentStopped(webmux, "feature/a");

    expect(events.map(({ event, data }) => [event, data.project, data.id])).toEqual([
      ["initial", "webmux", 1],
      ["dismiss", "webmux", 1],
    ]);
    const later: NotificationHubEvent[] = [];
    hub.subscribe((event) => later.push(event));
    expect(later).toEqual([]);
  });

  it("replaces a re-added project's source instead of double-forwarding", () => {
    const hub = new NotificationHub();
    const previous = new NotificationService("webmux");
    hub.addSource(previous);
    const replacement = new NotificationService("webmux");
    hub.addSource(replacement);
    const events: NotificationHubEvent[] = [];
    hub.subscribe((event) => events.push(event));

    agentStopped(previous, "main");
    agentStopped(replacement, "main");

    expect(events.map(({ event, data }) => [event, data.project, data.id])).toEqual([
      ["notification", "webmux", 1],
    ]);
  });

  it("drops a client when it unsubscribes", () => {
    const webmux = new NotificationService("webmux");
    const hub = new NotificationHub();
    hub.addSource(webmux);
    const events: NotificationHubEvent[] = [];
    const unsubscribe = hub.subscribe((event) => events.push(event));

    unsubscribe();
    agentStopped(webmux, "main");

    expect(events).toEqual([]);
    expect(hub.clientCount()).toBe(0);
  });

  it("streams merged events as SSE and releases the client on cancel", async () => {
    const webmux = new NotificationService("webmux");
    const images = new NotificationService("images");
    agentStopped(webmux, "main");
    const hub = new NotificationHub();
    hub.addSource(webmux);
    hub.addSource(images);

    const reader = hub.stream().body!.getReader();
    const initial = await readChunk(reader);
    expect(initial).toContain("event: initial");
    expect(initial).toContain(`"project":"webmux"`);

    const livePromise = readChunk(reader);
    agentStopped(images, "feature/a");
    const live = await livePromise;
    expect(live).toContain("event: notification");
    expect(live).toContain(`"project":"images"`);

    const dismissPromise = readChunk(reader);
    webmux.dismiss(1);
    expect(await dismissPromise).toBe(`event: dismiss\ndata: {"project":"webmux","id":1}\n\n`);

    expect(hub.clientCount()).toBe(1);
    await reader.cancel();
    expect(hub.clientCount()).toBe(0);
  });
});
