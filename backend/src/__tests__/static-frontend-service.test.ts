import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serveStaticFrontend } from "../services/static-frontend-service";

describe("serveStaticFrontend", () => {
  let dir = "";

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "webmux-static-"));
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "index.html"), "<html>app</html>");
    writeFileSync(join(dir, "assets", "x.js"), "console.log(1)");
    writeFileSync(join(dir, "favicon.svg"), "<svg/>");
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("serves index.html at / without caching", async () => {
    const res = await serveStaticFrontend(dir, "/");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
    expect(await res.text()).toBe("<html>app</html>");
  });

  it("returns 404 for a project path instead of falling back to the app", async () => {
    expect((await serveStaticFrontend(dir, "/webmux")).status).toBe(404);
    expect((await serveStaticFrontend(dir, "/webmux/")).status).toBe(404);
    expect((await serveStaticFrontend(dir, "/webmux/feat/x")).status).toBe(404);
  });

  it("returns 404 for a directory", async () => {
    expect((await serveStaticFrontend(dir, "/assets/")).status).toBe(404);
  });

  it("serves hashed assets as immutable", async () => {
    const res = await serveStaticFrontend(dir, "/assets/x.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(await res.text()).toBe("console.log(1)");
  });

  it("serves other real files without immutable caching", async () => {
    const res = await serveStaticFrontend(dir, "/favicon.svg");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("rejects path traversal", async () => {
    expect((await serveStaticFrontend(dir, "/../etc/passwd")).status).toBe(403);
  });
});
