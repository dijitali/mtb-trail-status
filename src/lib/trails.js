/**
 * Trail data model: parsing the club-maintained CSV and joining it with
 * cached OSM geometry. Pure functions, no DOM or map dependencies.
 */
import Papa from "papaparse";

/** @typedef {"open"|"closed"|"unknown"} TrailStatus */

/**
 * @typedef {object} Trail
 * @property {number} osmId
 * @property {string} name
 * @property {TrailStatus} status
 * @property {string} statusLabel  original text from the CSV, for display
 * @property {string} grade
 * @property {string} comments
 */

const STATUS_ALIASES = {
  open: "open",
  opened: "open",
  closed: "closed",
  close: "closed",
  shut: "closed",
};

/**
 * @param {string|undefined} value
 * @returns {TrailStatus}
 */
export function normaliseStatus(value) {
  const key = String(value ?? "").trim().toLowerCase();
  return STATUS_ALIASES[key] || "unknown";
}

/** Lower-case and trim CSV header names so "OSM ID", "osmId" and "osmid" all match. */
function normaliseRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.toLowerCase().replace(/[\s_]/g, "")] = typeof value === "string" ? value.trim() : value;
  }
  return out;
}

/**
 * Parse trails CSV text into Trail records.
 * Rows without a numeric osmId are reported in `errors` rather than dropped silently.
 *
 * @param {string} csvText
 * @param {{ defaults?: Partial<Trail> }} [options]
 * @returns {{ trails: Trail[], errors: string[] }}
 */
export function parseTrailsCsv(csvText, options = {}) {
  const defaults = { name: "Unnamed trail", grade: "", comments: "", ...(options.defaults || {}) };
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: "greedy" });
  const trails = [];
  const errors = parsed.errors
    .filter((e) => e.type !== "FieldMismatch")
    .map((e) => `CSV line ${e.row + 2}: ${e.message}`);

  parsed.data.forEach((rawRow, index) => {
    const row = normaliseRow(rawRow);
    const osmId = Number.parseInt(row.osmid, 10);
    if (!Number.isFinite(osmId) || osmId <= 0) {
      errors.push(`CSV line ${index + 2}: missing or invalid osmId (${JSON.stringify(row.osmid ?? "")})`);
      return;
    }
    const statusText = row.status || "";
    trails.push({
      osmId,
      name: row.name || defaults.name,
      status: normaliseStatus(statusText),
      statusLabel: statusText || "Unknown",
      grade: row.grade || defaults.grade,
      comments: row.comments || defaults.comments,
    });
  });

  return { trails, errors };
}

/**
 * Split trails into those with cached geometry and those still needing a fetch.
 *
 * @param {Trail[]} trails
 * @param {{ features?: object[] }} geometryCollection GeoJSON FeatureCollection keyed by properties.osmId
 * @returns {{ features: object[], missing: Trail[] }} GeoJSON features with trail properties merged in
 */
export function joinTrailsWithGeometry(trails, geometryCollection) {
  const byId = new Map();
  for (const feature of geometryCollection?.features || []) {
    const id = Number(feature.properties?.osmId ?? feature.id);
    if (Number.isFinite(id)) byId.set(id, feature);
  }
  const features = [];
  const missing = [];
  for (const trail of trails) {
    const cached = byId.get(trail.osmId);
    if (cached) {
      features.push(mergeTrailFeature(cached, trail));
    } else {
      missing.push(trail);
    }
  }
  return { features, missing };
}

/** Merge trail (CSV) properties onto a geometry feature. CSV values win over OSM tags. */
export function mergeTrailFeature(feature, trail) {
  return {
    type: "Feature",
    id: trail.osmId,
    geometry: feature.geometry,
    properties: {
      ...feature.properties,
      ...trail,
    },
  };
}
