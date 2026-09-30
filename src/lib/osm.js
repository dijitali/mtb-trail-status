/**
 * OpenStreetMap geometry helpers.
 *
 * These functions are environment-agnostic (no DOM, no OpenLayers) so they
 * can be shared by the browser app and the Node build script that snapshots
 * trail geometry into `public/trails.geojson`.
 */

export const DEFAULT_OSM_API = "https://api.openstreetmap.org/api/0.6";

/**
 * Interpret an OSM `oneway` tag.
 * @param {string|undefined} value
 * @returns {"forward"|"reverse"|null} direction of travel along the way, or null if two-way
 */
export function parseOneway(value) {
  if (value == null) return null;
  const v = String(value).trim().toLowerCase();
  if (v === "yes" || v === "true" || v === "1") return "forward";
  if (v === "-1" || v === "reverse") return "reverse";
  return null;
}

/**
 * Convert the response of `GET /api/0.6/way/{id}/full.json` into a
 * lon/lat coordinate list for the requested way.
 *
 * @param {{elements: Array<object>}} json OSM API response
 * @param {number} wayId the way that was requested
 * @returns {{coordinates: number[][], tags: Record<string,string>}}
 */
export function wayFullToGeometry(json, wayId) {
  const elements = (json && json.elements) || [];
  const way = elements.find((el) => el.type === "way" && el.id === wayId);
  if (!way) {
    throw new Error(`Way ${wayId} not present in OSM response`);
  }
  const nodes = new Map();
  for (const el of elements) {
    if (el.type === "node") nodes.set(el.id, [el.lon, el.lat]);
  }
  const coordinates = [];
  for (const nodeId of way.nodes || []) {
    const coord = nodes.get(nodeId);
    if (coord) coordinates.push(coord);
  }
  if (coordinates.length < 2) {
    throw new Error(`Way ${wayId} has fewer than 2 located nodes`);
  }
  return { coordinates, tags: way.tags || {} };
}

/**
 * Build a GeoJSON Feature for a trail way.
 * Only the OSM tags the app uses are kept, to keep the cache small and stable.
 */
export function toGeoJsonFeature(wayId, { coordinates, tags }) {
  return {
    type: "Feature",
    id: wayId,
    properties: {
      osmId: wayId,
      osmName: tags.name || null,
      oneway: parseOneway(tags.oneway),
      surface: tags.surface || null,
    },
    geometry: { type: "LineString", coordinates },
  };
}

/**
 * Fetch a single way's geometry from the OSM API.
 * @param {number} wayId
 * @param {{ apiBase?: string, fetch?: typeof fetch }} [options]
 */
export async function fetchWayGeometry(wayId, options = {}) {
  const apiBase = options.apiBase || DEFAULT_OSM_API;
  const doFetch = options.fetch || globalThis.fetch;
  const url = `${apiBase}/way/${wayId}/full.json`;
  const response = await doFetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`OSM API ${response.status} for way ${wayId}`);
  }
  return wayFullToGeometry(await response.json(), wayId);
}

/**
 * Fetch several ways with bounded concurrency. Failures are collected rather
 * than thrown so one bad ID doesn't prevent the rest from loading.
 *
 * @param {number[]} wayIds
 * @param {{ apiBase?: string, fetch?: typeof fetch, concurrency?: number }} [options]
 * @returns {Promise<{features: object[], errors: Array<{wayId:number, error:Error}>}>}
 */
export async function fetchWayFeatures(wayIds, options = {}) {
  const concurrency = options.concurrency || 4;
  const queue = [...wayIds];
  const features = [];
  const errors = [];

  async function worker() {
    while (queue.length) {
      const wayId = queue.shift();
      try {
        features.push(toGeoJsonFeature(wayId, await fetchWayGeometry(wayId, options)));
      } catch (error) {
        errors.push({ wayId, error });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, wayIds.length) }, worker));
  features.sort((a, b) => a.id - b.id);
  return { features, errors };
}
