import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Rata",
        short_name: "Rata",
        description: "Share costs with family and friends. Free, open source, private.",
        theme_color: "#0d0d0d",
        background_color: "#0d0d0d",
        display: "standalone",
        start_url: "/",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,svg}", "**/manrope-latin*.woff2"],
      },
    }),
  ],
  server: { proxy: { "/api": { target: "http://localhost:8787", ws: true } } },
});
