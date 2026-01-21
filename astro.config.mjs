import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

// Use Webflow Cloud environment variables for base and assets
// BASE_URL = mount path (e.g., /pulse)
// ASSETS_PREFIX = worker URL for static assets
const base = process.env.BASE_URL || "/pulse";
const assetsPrefix = process.env.ASSETS_PREFIX || base;

// https://astro.build/config
export default defineConfig({
  base,
  build: {
    assetsPrefix,
  },
  output: "server",
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
  vite: {
    resolve: {
      // Use react-dom/server.edge instead of react-dom/server.browser for React 19.
      // Without this, MessageChannel from node:worker_threads needs to be polyfilled.
      alias: import.meta.env.PROD
        ? {
            "react-dom/server": "react-dom/server.edge",
          }
        : undefined,
    },
  },
});