import { join, resolve } from "node:path";

/** Serve the built frontend. The app only lives at `/` (index.html, never
 *  cached so new deploys take effect); any other path must be a real file under
 *  `staticDir` (Vite-hashed `/assets/*` are cached forever), else 404 — there
 *  is no SPA fallback, so `/<project>` no longer renders the dashboard. */
export async function serveStaticFrontend(staticDir: string, pathname: string): Promise<Response> {
  if (pathname === "/") {
    return new Response(Bun.file(join(staticDir, "index.html")), {
      headers: { "Cache-Control": "no-cache" },
    });
  }
  const staticRoot = resolve(staticDir);
  const filePath = resolve(join(staticDir, pathname));
  // Path traversal protection: resolved path must stay within staticDir
  if (!filePath.startsWith(staticRoot + "/")) {
    return new Response("Forbidden", { status: 403 });
  }
  const file = Bun.file(filePath);
  if (!(await file.exists())) return new Response("Not Found", { status: 404 });
  const headers: HeadersInit = pathname.startsWith("/assets/")
    ? { "Cache-Control": "public, max-age=31536000, immutable" }
    : {};
  return new Response(file, { headers });
}
