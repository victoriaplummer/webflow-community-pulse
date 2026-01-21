import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

// Use Webflow Cloud environment variables for base and assets
// According to Webflow Cloud docs, use import.meta.env not process.env
// BASE_URL = mount path (e.g., /pulse)
// ASSETS_PREFIX = worker URL for static assets (full URL with https://)
const base = import.meta.env.BASE_URL || "/pulse";
const assetsPrefix = import.meta.env.ASSETS_PREFIX;

console.log("[Astro Config] BASE_URL:", import.meta.env.BASE_URL);
console.log("[Astro Config] ASSETS_PREFIX:", import.meta.env.ASSETS_PREFIX);
console.log("[Astro Config] Using base:", base);
console.log("[Astro Config] Using assetsPrefix:", assetsPrefix);

// https://astro.build/config
export default defineConfig({
  base,
  build: assetsPrefix ? {
    assetsPrefix,
  } : {},
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
    base: assetsPrefix || base,
    build: {
      rollupOptions: {
        output: {
          // Ensure assets use the correct public path
          assetFileNames: '_astro/[name].[hash][extname]',
          chunkFileNames: '_astro/[name].[hash].js',
          entryFileNames: '_astro/[name].[hash].js',
        },
      },
    },
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