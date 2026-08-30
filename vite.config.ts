import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves project sites from /<repo>/, so the base must match the
// repo name. The workflow sets VITE_BASE; local dev uses "/".
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // We ship our own manifest + icons in public/; the plugin only adds the service worker.
      manifest: false,
      registerType: "prompt",
      injectRegister: null,
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,webmanifest}", "icons/*.png"],
        globIgnores: ["cards/**", "photos/**"],
        // Photos and cards are fetched on demand and cached after first use.
        runtimeCaching: [
          { urlPattern: /\/photos\//, handler: "CacheFirst", options: { cacheName: "photos", expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 } } },
          { urlPattern: /\/cards\//, handler: "NetworkFirst", options: { cacheName: "cards" } },
          { urlPattern: /fonts\.(googleapis|gstatic)\.com/, handler: "StaleWhileRevalidate", options: { cacheName: "fonts" } },
        ],
      },
    }),
  ],
  base: process.env.VITE_BASE ?? "/",
});
