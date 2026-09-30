import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import config from "./config.json" with { type: "json" };

const TILE_HOST = new URL(config.map.tileUrl, "http://localhost/").host;
const OSM_API_HOST = new URL(config.geometry.osmApi).host;
const DAY = 24 * 60 * 60;

export default defineConfig({
  // Set BASE_PATH (e.g. "/mtb-trail-status/") when hosting under a sub-path such as GitHub Pages.
  base: process.env.BASE_PATH || "/",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: config.title,
        short_name: "Trail Status",
        description: "Mountain bike trail map with difficulty grades and open/closed status.",
        theme_color: "#1b5e20",
        background_color: "#ffffff",
        display: "standalone",
        icons: [{ src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: {
        // App shell is precached; data files are fetched network-first so status edits show up promptly.
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        globIgnores: ["**/trails.csv", "**/trails.geojson"],
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith(".csv") || url.pathname.endsWith(".geojson"),
            handler: "NetworkFirst",
            options: { cacheName: "trail-data", networkTimeoutSeconds: 4 },
          },
          {
            urlPattern: ({ url }) => url.host === TILE_HOST,
            handler: "CacheFirst",
            options: {
              cacheName: "osm-tiles",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 2000, maxAgeSeconds: 60 * DAY, purgeOnQuotaError: true },
            },
          },
          {
            urlPattern: ({ url }) => url.host === OSM_API_HOST,
            handler: "NetworkFirst",
            options: { cacheName: "osm-api", networkTimeoutSeconds: 8, expiration: { maxEntries: 200 } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["test/**/*.test.js"],
  },
});
