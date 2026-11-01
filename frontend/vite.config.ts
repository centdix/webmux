import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";

const backendPort = process.env.PORT || "5111";
const backendUrl = `http://localhost:${backendPort}`;
const port = parseInt(process.env.FRONTEND_PORT || "5112");

// Hub and per-project routes (WebSockets included) all live under `/api`.
const proxy = {
  "^/api(?:/|$)": {
    target: backendUrl,
    ws: true,
  },
};

// Dev stand-in for the backend's old `/<project>` bookmark redirect: a page
// path Vite has nothing for is asked of the backend, and its redirect forwarded.
function legacyProjectRedirect(): Plugin {
  return {
    name: "webmux-legacy-project-redirect",
    configureServer(server) {
      return () => {
        server.middlewares.use(async (req, res, next) => {
          const path = (req.url ?? "/").split("?")[0];
          const lastSegment = path.split("/").pop() ?? "";
          if ((req.method !== "GET" && req.method !== "HEAD") || lastSegment.includes(".") || /^\/(@|api(\/|$)|src\/|node_modules\/)/.test(path)) {
            next();
            return;
          }
          try {
            const backend = await fetch(`${backendUrl}${path}`, { redirect: "manual" });
            const location = backend.headers.get("location");
            if (backend.status === 302 && location) {
              res.writeHead(302, { Location: location }).end();
              return;
            }
          } catch {
            // Backend not up: fall through to Vite's 404.
          }
          next();
        });
      };
    },
  };
}

export default defineConfig({
  plugins: [svelte(), tailwindcss(), legacyProjectRedirect()],
  // No SPA fallback: the app only lives at `/`, any other HTML path 404s
  // (matches the backend's static serving).
  appType: "mpa",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@xterm/")) {
            return "vendor-xterm";
          }
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ['diego-devbox'],
    port,
    proxy,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    proxy,
  },
});
