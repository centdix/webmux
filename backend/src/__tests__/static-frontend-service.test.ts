import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serveStaticFrontend, serveUnmatchedRequest } from "../services/static-frontend-service";

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

  it("serves /index.html without caching too", async () => {
    const res = await serveStaticFrontend(dir, "/index.html");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
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

describe("serveUnmatchedRequest", () => {
  let dir = "";
  const isProject = (prefix: string): boolean => prefix === "webmux" || prefix === "assets";

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "webmux-unmatched-"));
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "index.html"), "<html>app</html>");
    writeFileSync(join(dir, "assets", "x.js"), "console.log(1)");
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("serves a real static file even under a project's prefix", async () => {
    const res = await serveUnmatchedRequest("GET", "/assets/x.js", dir, isProject);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("console.log(1)");
  });

  it("redirects a registered prefix the frontend doesn't have, with or without static files", async () => {
    for (const staticDir of [dir, ""]) {
      const res = await serveUnmatchedRequest("GET", "/webmux/feat/x", staticDir, isProject);
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/#webmux");
    }
  });

  it("404s an unknown prefix and never redirects an API path", async () => {
    expect((await serveUnmatchedRequest("GET", "/other", dir, isProject)).status).toBe(404);
    for (const path of ["/api/nope", "/webmux/api/worktrees"]) {
      const res = await serveUnmatchedRequest("GET", path, dir, isProject);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: `No route for GET ${path}` });
    }
  });
});
