#!/usr/bin/env node
/**
 * Snapshot trail geometry from OpenStreetMap into public/trails.geojson.
 *
 *   npm run fetch-geometry            # fetch any trails missing from the cache
 *   npm run fetch-geometry -- --all   # re-fetch every trail (picks up OSM edits)
 *   npm run fetch-geometry -- --check # exit 1 if any CSV trail lacks cached geometry (no network)
 *
 * The app reads this file at runtime so visitors never depend on a live OSM
 * query, and so the map keeps working offline.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseTrailsCsv } from "../src/lib/trails.js";
import { fetchWayFeatures } from "../src/lib/osm.js";
import config from "../config.json" with { type: "json" };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = path.join(root, "public", config.data.trails);
const geojsonPath = path.join(root, "public", config.data.geometry);
const args = new Set(process.argv.slice(2));

/** Pretty-print with one coordinate pair per line so diffs stay readable. */
function serialiseGeoJson(collection) {
  const text = JSON.stringify(collection, null, 2);
  return text.replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, "[$1, $2]") + "\n";
}

async function readCache() {
  try {
    return JSON.parse(await readFile(geojsonPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { type: "FeatureCollection", features: [] };
    throw error;
  }
}

async function main() {
  const { trails, errors } = parseTrailsCsv(await readFile(csvPath, "utf8"));
  for (const message of errors) console.warn(`warning: ${message}`);

  const cache = await readCache();
  const cached = new Map(cache.features.map((f) => [Number(f.properties.osmId), f]));
  const wanted = trails.map((t) => t.osmId);
  const missing = wanted.filter((id) => !cached.has(id));

  if (args.has("--check")) {
    if (missing.length) {
      console.error(`Missing geometry for ${missing.length} trail(s): ${missing.join(", ")}`);
      console.error("Run `npm run fetch-geometry` and commit the updated trails.geojson.");
      process.exit(1);
    }
    console.log(`All ${wanted.length} trails have cached geometry.`);
    return;
  }

  const toFetch = args.has("--all") ? wanted : missing;
  if (!toFetch.length) {
    console.log("Geometry cache is up to date; nothing to fetch.");
    return;
  }

  console.log(`Fetching ${toFetch.length} way(s) from ${config.geometry.osmApi} ...`);
  const { features, errors: fetchErrors } = await fetchWayFeatures(toFetch, {
    apiBase: config.geometry.osmApi,
    concurrency: 4,
  });
  for (const { wayId, error } of fetchErrors) {
    console.error(`error: way ${wayId}: ${error.message}`);
  }
  for (const feature of features) cached.set(feature.id, feature);

  // Keep only trails still listed in the CSV, in CSV order, so the file stays tidy.
  const output = {
    type: "FeatureCollection",
    attribution: "© OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright",
    generated: new Date().toISOString(),
    features: wanted.filter((id) => cached.has(id)).map((id) => cached.get(id)),
  };
  await writeFile(geojsonPath, serialiseGeoJson(output));
  console.log(`Wrote ${output.features.length} feature(s) to ${path.relative(root, geojsonPath)}`);
  if (fetchErrors.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
