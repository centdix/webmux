import { describe, expect, it } from "vitest";
import config from "../vite.config";

describe("Vite backend proxy", () => {
  it.each([
    ["development", config.server?.proxy],
    ["preview", config.preview?.proxy],
  ])("proxies project-prefixed API and WebSocket routes in %s", (_mode, proxy) => {
    expect(proxy).toHaveProperty("^/[^/]+/api");
    expect(proxy).toHaveProperty("^/[^/]+/ws");
  });
});
