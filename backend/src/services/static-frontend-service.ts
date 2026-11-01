import { join, resolve } from "node:path";
import { isApiPath, legacyProjectRedirect } from "../domain/project-routes";
import { errorResponse } from "../lib/http";

/** Serve the built frontend. The app only lives at `/` (index.html, never
 *  cached so new deploys take effect); any other path must be a real file under
 *  `staticDir` (Vite-hashed `/assets/*` are cached forever), else 404 — there
 *  is no SPA fallback, so `/<project>` no longer renders the dashboard. */
export async function serveStaticFrontend(staticDir: string, pathname: string): Promise<Response> {
  if (pathname === "/" || pathname === "/index.html") {
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

/** Response for a request no route matched: API paths always 404; otherwise
 *  the built frontend (when `staticDir` is set) wins, and only a path it
 *  doesn't have redirects an old `/<prefix>` bookmark to the project's hash. */
export async function serveUnmatchedRequest(
  method: string,
  pathname: string,
  staticDir: string,
  isProject: (prefix: string) => boolean,
): Promise<Response> {
  if (isApiPath(pathname)) return errorResponse(`No route for ${method} ${pathname}`, 404);
  const res = staticDir ? await serveStaticFrontend(staticDir, pathname) : new Response("Not Found", { status: 404 });
  if (res.status !== 404) return res;
  const redirect = legacyProjectRedirect(pathname, isProject);
  return redirect ? new Response(null, { status: 302, headers: { Location: redirect } }) : res;
}
