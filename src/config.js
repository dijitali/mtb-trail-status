/**
 * The selected park's configuration, validated and bundled at build time
 * (see scripts/vite-plugin-park.mjs). Choose the park with PARK=<folder>.
 */
import park from "virtual:park-config";
import { UNGRADED, normaliseGradeKey } from "./park/grading";

export const config = park;

/** Tile URL template; relative templates are resolved against the page so bundled tiles work. */
export const TILE_URL = config.map.tileUrl;

/** URL of one of the park's data files, relative to the page. */
export function parkDataUrl(name) {
  return `park/${name}`;
}

const gradesByKey = new Map(config.grades.map((g) => [g.key, g]));

/**
 * Display details for a grade value from the CSV.
 * @param {string|number|undefined} grade
 * @returns {{ key: string, name: string, color: string, label?: string, display: string }}
 */
export function getGrade(grade) {
  return gradesByKey.get(normaliseGradeKey(grade)) || UNGRADED;
}

/** Grades in the park's display order. */
export function listGrades() {
  return config.grades;
}
