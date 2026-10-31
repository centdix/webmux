import { defineConfig } from "vite";
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

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
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
