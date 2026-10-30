/**
 * Loads the park's data: the club-maintained trails CSV plus the committed
 * geometry cache (with a live OSM API fallback for any trail not yet cached),
 * and the optional points-of-interest CSV.
 */
import { config, parkDataUrl } from "./config";
import { parseTrailsCsv, joinTrailsWithGeometry, mergeTrailFeature } from "./lib/trails";
import { parsePoisCsv } from "./lib/pois";
import { fetchWayFeatures } from "./lib/osm";

class NotFoundError extends Error {}

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (response.status === 404) throw new NotFoundError(`${url} not found`);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  // Single-page hosts often answer a missing file with index.html and a 200; treat that as missing.
  if ((response.headers.get("content-type") || "").includes("text/html")) throw new NotFoundError(`${url} not found`);
  return response.text();
}

async function loadPois(warnings) {
  if (!config.data.pois) return [];
  try {
    const { pois, errors } = parsePoisCsv(await fetchText(parkDataUrl(config.data.pois)));
    warnings.push(...errors);
    return pois;
  } catch (error) {
    // A park without a places file is normal; anything else is worth reporting.
    if (!(error instanceof NotFoundError)) warnings.push(`Couldn't load places: ${error.message}`);
    return [];
  }
}

/**
 * @returns {Promise<{ features: object[], trails: object[], pois: object[], warnings: string[] }>}
 *   `features` are GeoJSON Features with CSV properties merged in.
 */
export async function loadParkData() {
  const warnings = [];

  const [csvText, geometry, pois] = await Promise.all([
    fetchText(parkDataUrl(config.data.trails)),
    fetchText(parkDataUrl(config.data.geometry))
      .then((text) => JSON.parse(text))
      .catch((error) => {
        warnings.push(`Geometry cache unavailable (${error.message}); fetching live from OpenStreetMap.`);
        return { features: [] };
      }),
    loadPois(warnings),
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

  return { features, trails, pois, warnings };
}
