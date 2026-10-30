/**
 * Locates the park being built and loads its validated configuration.
 * The park is chosen by the PARK environment variable, falling back to
 * "config.park" in package.json.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveParkConfig } from "../src/park/parkConfig.js";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PARKS_DIR = path.join(ROOT, "parks");

export function listParks() {
  return readdirSync(PARKS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(PARKS_DIR, d.name, "park.json")))
    .map((d) => d.name)
    .sort();
}

export function selectedParkId() {
  if (process.env.PARK) return process.env.PARK;
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  return pkg.config?.park;
}

/**
 * @param {string} [id]
 * @returns {{ id: string, dir: string, config: object }}
 */
export function loadPark(id = selectedParkId()) {
  if (!id) throw new Error('No park selected. Set PARK=<folder name> or "config.park" in package.json.');
  const dir = path.join(PARKS_DIR, id);
  const file = path.join(dir, "park.json");
  if (!existsSync(file)) {
    throw new Error(`Park "${id}" not found: expected ${path.relative(ROOT, file)}. Available parks: ${listParks().join(", ") || "none"}`);
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${path.relative(ROOT, file)} is not valid JSON: ${error.message}`);
  }
  const config = resolveParkConfig(raw, { source: path.relative(ROOT, file) });
  return { id, dir, config };
}

/** Data files the app fetches at runtime, which are copied to <base>/park/ in the build. */
export function parkDataFiles(config) {
  return [config.data.trails, config.data.pois, config.data.geometry].filter(Boolean);
}
