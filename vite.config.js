import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { loadPark } from "./scripts/park.mjs";
import { parkPlugin } from "./scripts/vite-plugin-park.mjs";

// Which park to build: PARK=<folder in parks/>, defaulting to "config.park" in package.json.
const park = loadPark();
const { config } = park;
const TILE_HOST = new URL(config.map.tileUrl, "http://localhost/").host;
const OSM_API_HOST = new URL(config.geometry.osmApi).host;
const DAY = 24 * 60 * 60;

export default defineConfig({
  // Set BASE_PATH (e.g. "/mtb-trail-status/") when hosting under a sub-path such as GitHub Pages.
  base: process.env.BASE_PATH || "/",
  plugins: [
    parkPlugin(park),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: config.title,
        short_name: config.shortName,
        description: config.description,
        theme_color: config.themeColor,
        background_color: "#ffffff",
        display: "standalone",
        icons: [{ src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: {
        // App shell is precached; park data is fetched network-first so status edits show up promptly.
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        globIgnores: ["park/**"],
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes("/park/"),
            handler: "NetworkFirst",
            options: { cacheName: "park-data", networkTimeoutSeconds: 4 },
          },
          {
            urlPattern: ({ url }) => url.host === TILE_HOST,
            handler: "CacheFirst",
            options: {
              cacheName: "map-tiles",
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
