#!/usr/bin/env node
/**
 * Snapshot trail geometry from OpenStreetMap, plus an elevation profile for
 * each trail, into public/trails.geojson.
 *
 *   npm run fetch-geometry                  # fetch anything missing from the cache
 *   npm run fetch-geometry -- --all         # re-fetch every trail and profile (picks up OSM edits)
 *   npm run fetch-geometry -- --profiles    # re-fetch every elevation profile only
 *   npm run fetch-geometry -- --check       # exit 1 if anything is missing (no network)
 *
 * The app reads this file at runtime so visitors never depend on a live OSM
 * or elevation query, and so the map and profiles keep working offline.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseTrailsCsv } from "../src/lib/trails.js";
import { fetchWayFeatures } from "../src/lib/osm.js";
import { samplePoints, buildProfile } from "../src/lib/profile.js";
import { fetchElevations } from "../src/lib/elevation.js";
import config from "../config.json" with { type: "json" };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = path.join(root, "public", config.data.trails);
const geojsonPath = path.join(root, "public", config.data.geometry);
const args = new Set(process.argv.slice(2));
const elevation = config.elevation || null;

/** Pretty-print with one coordinate pair per line and each elevation list on one line, so diffs stay readable. */
function serialiseGeoJson(collection) {
  return (
    JSON.stringify(collection, null, 2)
      .replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, "[$1, $2]")
      .replace(/"ele": \[([\s\d.,-]*)\]/g, (_, list) => `"ele": [${list.trim().split(/\s*,\s*/).join(", ")}]`) + "\n"
  );
}

async function readCache() {
  try {
    return JSON.parse(await readFile(geojsonPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { type: "FeatureCollection", features: [] };
    throw error;
  }
}

/** Sample every feature's line, look up all the points in shared batches, and attach profiles. */
async function addProfiles(features) {
  const step = elevation.step || 10;
  const samples = features.map((f) => samplePoints(f.geometry.coordinates, step));
  const allPoints = samples.flatMap((s) => s.points);
  console.log(`Looking up ${allPoints.length} elevation(s) from ${elevation.dataset} ...`);
  const elevations = await fetchElevations(allPoints, {
    api: elevation.api,
    dataset: elevation.dataset,
    onProgress: (done, total) => process.stdout.write(`\r  ${done}/${total}`),
  });
  process.stdout.write("\n");
  let offset = 0;
  features.forEach((feature, i) => {
    const { points, length } = samples[i];
    feature.properties.profile = buildProfile(step, length, elevations.slice(offset, offset + points.length));
    offset += points.length;
  });
}

async function main() {
  const { trails, errors } = parseTrailsCsv(await readFile(csvPath, "utf8"));
  for (const message of errors) console.warn(`warning: ${message}`);

  const cache = await readCache();
  const cached = new Map(cache.features.map((f) => [Number(f.properties.osmId), f]));
  const wanted = trails.map((t) => t.osmId);
  const missing = wanted.filter((id) => !cached.has(id));
  const noProfile = elevation ? wanted.filter((id) => cached.has(id) && !cached.get(id).properties.profile) : [];

  if (args.has("--check")) {
    let ok = true;
    if (missing.length) {
      console.error(`Missing geometry for ${missing.length} trail(s): ${missing.join(", ")}`);
      ok = false;
    }
    if (noProfile.length) {
      console.error(`Missing elevation profile for ${noProfile.length} trail(s): ${noProfile.join(", ")}`);
      ok = false;
    }
    if (!ok) {
      console.error("Run `npm run fetch-geometry` and commit the updated trails.geojson.");
      process.exit(1);
    }
    console.log(`All ${wanted.length} trails have cached geometry${elevation ? " and profiles" : ""}.`);
    return;
  }

  let failed = false;
  const toFetch = args.has("--all") ? wanted : missing;
  if (toFetch.length) {
    console.log(`Fetching ${toFetch.length} way(s) from ${config.geometry.osmApi} ...`);
    const { features, errors: fetchErrors } = await fetchWayFeatures(toFetch, {
      apiBase: config.geometry.osmApi,
      concurrency: 4,
    });
    for (const { wayId, error } of fetchErrors) console.error(`error: way ${wayId}: ${error.message}`);
    for (const feature of features) cached.set(feature.id, feature);
    failed ||= fetchErrors.length > 0;
  }

  if (elevation) {
    const refreshAll = args.has("--all") || args.has("--profiles");
    const needProfile = wanted
      .filter((id) => cached.has(id))
      .map((id) => cached.get(id))
      .filter((f) => refreshAll || !f.properties.profile);
    if (needProfile.length) {
      try {
        await addProfiles(needProfile);
      } catch (error) {
        console.error(`error: elevation lookup failed: ${error.message}`);
        failed = true;
      }
    }
  }

  if (!toFetch.length && !failed && cache.features.length && !args.has("--profiles") && !noProfile.length) {
    console.log("Cache is up to date; nothing to fetch.");
    return;
  }

  // Keep only trails still listed in the CSV, in CSV order, so the file stays tidy.
  const attribution = ["Trails © OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright"];
  if (elevation?.attribution) attribution.push(elevation.attribution);
  const output = {
    type: "FeatureCollection",
    attribution: attribution.join(". "),
    generated: new Date().toISOString(),
    features: wanted.filter((id) => cached.has(id)).map((id) => cached.get(id)),
  };
  await writeFile(geojsonPath, serialiseGeoJson(output));
  console.log(`Wrote ${output.features.length} feature(s) to ${path.relative(root, geojsonPath)}`);
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
