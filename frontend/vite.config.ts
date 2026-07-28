import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";

const backendPort = process.env.PORT || "5111";
const backendUrl = `http://localhost:${backendPort}`;
const backendWs = `ws://localhost:${backendPort}`;
const port = parseInt(process.env.FRONTEND_PORT || "5112");
const backendProxy = {
  "/api": backendUrl,
  "^/[^/]+/api": backendUrl,
  "/ws": {
    target: backendWs,
    ws: true,
  },
  "^/[^/]+/ws": {
    target: backendWs,
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
    proxy: backendProxy,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    proxy: backendProxy,
  },
});
