/**
 * Loads trail data: the club-maintained CSV plus the committed geometry
 * cache, with a live OSM API fallback for any trail not yet cached.
 */
import { config } from "./config";
import { parseTrailsCsv, joinTrailsWithGeometry, mergeTrailFeature } from "./lib/trails";
import { fetchWayFeatures } from "./lib/osm";

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

/**
 * @returns {Promise<{ features: object[], trails: object[], warnings: string[] }>}
 *   `features` are GeoJSON Features with CSV properties merged in.
 */
export async function loadTrails() {
  const warnings = [];

  const [csvText, geometry] = await Promise.all([
    fetchText(config.data.trails),
    fetchText(config.data.geometry)
      .then((text) => JSON.parse(text))
      .catch((error) => {
        warnings.push(`Geometry cache unavailable (${error.message}); fetching live from OpenStreetMap.`);
        return { features: [] };
      }),
  ]);

  const { trails, errors } = parseTrailsCsv(csvText);
  warnings.push(...errors);

  const { features, missing } = joinTrailsWithGeometry(trails, geometry);

  if (missing.length) {
    const byId = new Map(missing.map((t) => [t.osmId, t]));
    const live = await fetchWayFeatures([...byId.keys()], { apiBase: config.geometry.osmApi });
    for (const feature of live.features) {
      features.push(mergeTrailFeature(feature, byId.get(feature.id)));
    }
    for (const { wayId, error } of live.errors) {
      const trail = byId.get(wayId);
      warnings.push(`Could not load "${trail.name}" (OSM way ${wayId}): ${error.message}`);
    }
    if (live.features.length) {
      warnings.push(
        `${live.features.length} trail(s) were fetched live from OpenStreetMap. Run \`npm run fetch-geometry\` to cache them for offline use.`
      );
    }
  }

  return { features, trails, warnings };
}
