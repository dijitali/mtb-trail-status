/**
 * Points of interest (entrances, car parks, shelters…): parsing the park's
 * pois.csv. Pure, no DOM or map dependencies.
 *
 *   name,type,lat,lon,description
 *   Rewa Road entrance,entrance,-36.88490,175.04038,Gate at the end of Rewa Road
 */
import Papa from "papaparse";

/** Supported types, in legend order. Colours are set in the map styles. */
export const POI_TYPES = {
  entrance: { label: "Entrance", aliases: ["trailhead", "trail head", "entry", "access"] },
  parking: { label: "Parking", aliases: ["car park", "carpark", "parking lot"] },
  shelter: { label: "Shelter", aliases: ["hut", "container"] },
  toilet: { label: "Toilets", aliases: ["toilets", "wc", "restroom", "restrooms"] },
  water: { label: "Drinking water", aliases: ["drinking water", "tap", "drinking-water"] },
  "bike-wash": { label: "Bike wash", aliases: ["bike wash", "wash"] },
  info: { label: "Information", aliases: ["information", "sign", "map board"] },
  "first-aid": { label: "First aid", aliases: ["first aid", "aed", "defibrillator", "emergency"] },
  viewpoint: { label: "Viewpoint", aliases: ["lookout", "view"] },
  other: { label: "Point of interest", aliases: [] },
};

const ALIASES = new Map(
  Object.entries(POI_TYPES).flatMap(([type, { aliases }]) => [[type, type], ...aliases.map((a) => [a, type])])
);

/** @returns {string|null} canonical type, or null if unrecognised */
export function normalisePoiType(value) {
  const key = String(value ?? "").trim().toLowerCase().replace(/_/g, "-");
  return ALIASES.get(key) ?? ALIASES.get(key.replace(/-/g, " ")) ?? null;
}

/** The type label to show beside a place, or null when its name already says it ("Rewa Road entrance"). */
export function typeLabelFor(poi) {
  const label = (POI_TYPES[poi.type] || POI_TYPES.other).label;
  return poi.name.toLowerCase().includes(label.toLowerCase()) ? null : label;
}

function normaliseRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.toLowerCase().replace(/[\s_]/g, "")] = typeof value === "string" ? value.trim() : value;
  }
  return out;
}

/**
 * @typedef {object} Poi
 * @property {string} id stable id derived from position in the file
 * @property {string} name
 * @property {string} type canonical type key from POI_TYPES
 * @property {number} lat
 * @property {number} lon
 * @property {string} description
 */

/**
 * @param {string} csvText
 * @returns {{ pois: Poi[], errors: string[] }} rows that can't be placed are reported, not dropped silently
 */
export function parsePoisCsv(csvText) {
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: "greedy" });
  const pois = [];
  const errors = parsed.errors.filter((e) => e.type !== "FieldMismatch").map((e) => `pois CSV line ${e.row + 2}: ${e.message}`);

  parsed.data.forEach((raw, index) => {
    const row = normaliseRow(raw);
    const line = index + 2;
    const lat = Number.parseFloat(row.lat ?? row.latitude);
    const lon = Number.parseFloat(row.lon ?? row.lng ?? row.longitude);
    if (!row.name) {
      errors.push(`pois CSV line ${line}: missing name`);
      return;
    }
    if (!(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) {
      errors.push(`pois CSV line ${line} ("${row.name}"): lat and lon must be decimal degrees`);
      return;
    }
    let type = normalisePoiType(row.type);
    if (!type) {
      if (row.type) errors.push(`pois CSV line ${line} ("${row.name}"): unknown type "${row.type}", shown as a general point of interest`);
      type = "other";
    }
    pois.push({ id: `poi-${index + 1}`, name: row.name, type, lat, lon, description: row.description || "" });
  });

  return { pois, errors };
}
