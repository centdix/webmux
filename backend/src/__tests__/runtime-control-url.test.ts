import { describe, expect, it } from "bun:test";
import { buildControlBaseUrl } from "../runtime";

// Regression: the server mounts every project's routes under
// `/api/projects/${prefix}` (see server.ts buildServeRoutes), so the control
// base URL that agent hooks POST to must carry the same mount point or the
// events fall through to the SPA and Claude's status never updates.
describe("buildControlBaseUrl", () => {
  it("points at the project's mount point under /api/projects", () => {
    expect(buildControlBaseUrl(5111, "webmux")).toBe("http://127.0.0.1:5111/api/projects/webmux");
  });

  it("returns undefined when there is no prefix, disabling control reporting", () => {
    // The CLI passes undefined when it can't resolve a prefix (no server
    // running). No control URL is better than a wrong one: the agent's hooks
    // no-op cleanly instead of POSTing to an unrouted path.
    expect(buildControlBaseUrl(5111, undefined)).toBeUndefined();
    expect(buildControlBaseUrl(5111, "")).toBeUndefined();
  });
});
