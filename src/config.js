/**
 * Application configuration, bundled at build time from ./config.json.
 * Importing it statically means a broken config fails the build instead of
 * failing silently in a visitor's browser.
 */
import raw from "../config.json";

export const config = Object.freeze(raw);

/** Tile URL template; relative templates are resolved against the page so bundled tiles work. */
export const TILE_URL = config.map.tileUrl || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/**
 * Look up display details for a grade value.
 * @param {string|number|undefined} grade
 * @returns {{ name: string, color: string }}
 */
export function getGrade(grade) {
  return config.grades[String(grade ?? "")] || config.grades.default;
}

/** Grades in display order (excludes the `default` entry). */
export function listGrades() {
  return Object.entries(config.grades)
    .filter(([key]) => key !== "default")
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([grade, details]) => ({ grade, ...details }));
}
