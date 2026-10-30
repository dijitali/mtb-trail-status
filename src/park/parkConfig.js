/**
 * Resolves a park's park.json into the full app configuration: fills in
 * defaults, expands the grading preset, and validates everything so a
 * mistake fails the build with a readable message instead of breaking the
 * page for riders. Pure: used by the app, the Vite build and the data script.
 */
import { GRADING_PRESETS, normaliseGradeKey, gradeDisplay } from "./grading.js";

export const DEFAULTS = {
  title: "Trail Status",
  shortName: "",
  description: "Mountain bike trail map with difficulty grades and open/closed status.",
  themeColor: "#1b5e20",
  map: {
    tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    rotation: 0,
    zoom: 13,
    center: null,
    padding: [60, 90, 60, 90],
  },
  grading: "nz",
  data: {
    trails: "trails.csv",
    pois: "pois.csv",
    geometry: "trails.geojson",
  },
  geometry: {
    osmApi: "https://api.openstreetmap.org/api/0.6",
  },
  // Global 30 m SRTM by default; parks with a better local model should set their own dataset.
  elevation: {
    api: "https://api.opentopodata.org/v1",
    dataset: "srtm30m",
    step: 10,
    attribution: "Elevation: NASA SRTM 30 m via OpenTopoData",
  },
  offline: {
    minZoom: 12,
    maxZoom: 16,
    maxTiles: 600,
  },
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const isObject = (v) => v != null && typeof v === "object" && !Array.isArray(v);
const isNumber = (v) => typeof v === "number" && Number.isFinite(v);

export class ParkConfigError extends Error {
  constructor(problems, source = "park.json") {
    super(`${source} has ${problems.length} problem(s):\n  - ${problems.join("\n  - ")}`);
    this.problems = problems;
  }
}

function resolveGrading(grading, problems) {
  let presetKey = null;
  let extra = {};
  if (typeof grading === "string") presetKey = grading;
  else if (isObject(grading)) {
    presetKey = grading.preset ?? null;
    extra = grading.grades ?? {};
    if (!isObject(extra)) {
      problems.push("grading.grades must be an object keyed by grade value");
      extra = {};
    }
  } else {
    problems.push('grading must be a preset name (e.g. "nz") or an object');
  }

  const grades = [];
  if (presetKey != null) {
    const preset = GRADING_PRESETS[presetKey];
    if (!preset) problems.push(`grading preset "${presetKey}" is unknown; use one of: ${Object.keys(GRADING_PRESETS).join(", ")}`);
    else grades.push(...preset.grades.map((g) => ({ ...g })));
  }

  for (const [rawKey, value] of Object.entries(extra)) {
    const key = normaliseGradeKey(rawKey);
    if (!isObject(value)) {
      problems.push(`grading.grades["${rawKey}"] must be an object with a name and color`);
      continue;
    }
    const existing = grades.find((g) => g.key === key);
    const merged = { ...(existing || { key }), ...value, key };
    if (existing) Object.assign(existing, merged);
    else grades.push(merged);
  }

  for (const g of grades) {
    if (!g.name || typeof g.name !== "string") problems.push(`grade "${g.key}" needs a name`);
    if (!HEX.test(g.color || "")) problems.push(`grade "${g.key}" needs a hex color like "#1f77b4" (got ${JSON.stringify(g.color)})`);
    g.display = gradeDisplay(g);
  }
  if (!grades.length) problems.push("grading defines no grades");
  return grades;
}

/**
 * @param {object} raw parsed park.json
 * @param {{ source?: string }} [options]
 * @returns {object} frozen, fully-populated configuration
 * @throws {ParkConfigError}
 */
export function resolveParkConfig(raw, { source } = {}) {
  const problems = [];
  if (!isObject(raw)) throw new ParkConfigError(["must be a JSON object"], source);

  const known = new Set([...Object.keys(DEFAULTS), "$comment"]);
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) problems.push(`unknown setting "${key}"`);
  }

  const section = (name) => {
    if (raw[name] === undefined) return { ...DEFAULTS[name] };
    if (!isObject(raw[name])) {
      problems.push(`${name} must be an object`);
      return { ...DEFAULTS[name] };
    }
    return { ...DEFAULTS[name], ...raw[name] };
  };

  const config = {
    title: raw.title ?? DEFAULTS.title,
    shortName: raw.shortName || raw.title || DEFAULTS.title,
    description: raw.description ?? DEFAULTS.description,
    themeColor: raw.themeColor ?? DEFAULTS.themeColor,
    map: section("map"),
    data: section("data"),
    geometry: section("geometry"),
    offline: section("offline"),
    elevation: raw.elevation === false ? null : section("elevation"),
  };

  if (typeof config.title !== "string" || !config.title.trim()) problems.push("title must be a non-empty string");
  if (!HEX.test(config.themeColor)) problems.push(`themeColor must be a hex colour (got ${JSON.stringify(config.themeColor)})`);

  const { map } = config;
  if (!isNumber(map.rotation)) problems.push("map.rotation must be a number of degrees");
  if (!isNumber(map.zoom)) problems.push("map.zoom must be a number");
  if (map.center !== null && !(Array.isArray(map.center) && map.center.length === 2 && map.center.every(isNumber))) {
    problems.push("map.center must be null (fit to the trails) or [longitude, latitude]");
  }
  if (!(Array.isArray(map.padding) && map.padding.length === 4 && map.padding.every(isNumber))) {
    problems.push("map.padding must be four numbers: [top, right, bottom, left]");
  }
  if (typeof map.tileUrl !== "string" || !["{z}", "{x}", "{y}"].every((t) => map.tileUrl.includes(t))) {
    problems.push("map.tileUrl must be a template containing {z}, {x} and {y}");
  }

  for (const [key, value] of Object.entries(config.data)) {
    if (value !== null && (typeof value !== "string" || !/^[\w.-]+$/.test(value))) {
      problems.push(`data.${key} must be a plain file name in the park folder (got ${JSON.stringify(value)})`);
    }
  }
  if (!config.data.trails) problems.push("data.trails is required");
  if (!config.data.geometry) problems.push("data.geometry is required");

  const { offline } = config;
  if (![offline.minZoom, offline.maxZoom, offline.maxTiles].every(isNumber) || offline.minZoom > offline.maxZoom) {
    problems.push("offline needs numeric minZoom <= maxZoom and a numeric maxTiles");
  }

  if (config.elevation) {
    if (typeof config.elevation.dataset !== "string" || !config.elevation.dataset) problems.push("elevation.dataset must name an OpenTopoData dataset");
    if (!isNumber(config.elevation.step) || config.elevation.step <= 0) problems.push("elevation.step must be a positive number of metres");
  }

  config.grades = resolveGrading(raw.grading ?? DEFAULTS.grading, problems);

  if (problems.length) throw new ParkConfigError(problems, source);
  return deepFreeze(config);
}

function deepFreeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
