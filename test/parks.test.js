/**
 * Every park folder in parks/ must be complete and valid, so adding a park
 * (or editing one) is checked by CI the same way as code.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { listParks, loadPark } from "../scripts/park.mjs";
import { parseTrailsCsv, joinTrailsWithGeometry } from "../src/lib/trails.js";
import { parsePoisCsv } from "../src/lib/pois.js";
import { normaliseGradeKey } from "../src/park/grading.js";

const parks = listParks();

it("has at least one park", () => {
  expect(parks.length).toBeGreaterThan(0);
});

describe.each(parks)("park %s", (id) => {
  const { dir, config } = loadPark(id);
  const read = (name) => readFileSync(path.join(dir, name), "utf8");

  it("has a valid trails CSV whose grades exist in the grading system", () => {
    const { trails, errors } = parseTrailsCsv(read(config.data.trails));
    expect(errors).toEqual([]);
    expect(trails.length).toBeGreaterThan(0);
    const keys = new Set(config.grades.map((g) => g.key));
    const unknown = trails.filter((t) => t.grade && !keys.has(normaliseGradeKey(t.grade))).map((t) => `${t.name}: ${t.grade}`);
    expect(unknown).toEqual([]);
  });

  it("has cached geometry, and profiles if enabled, for every trail", () => {
    const { trails } = parseTrailsCsv(read(config.data.trails));
    const { features, missing } = joinTrailsWithGeometry(trails, JSON.parse(read(config.data.geometry)));
    expect(missing.map((t) => t.name)).toEqual([]);
    if (config.elevation) {
      expect(features.filter((f) => !f.properties.profile).map((f) => f.properties.name)).toEqual([]);
    }
  });

  it("has a valid places CSV if it has one", () => {
    if (!config.data.pois || !existsSync(path.join(dir, config.data.pois))) return;
    const { errors } = parsePoisCsv(read(config.data.pois));
    expect(errors).toEqual([]);
  });
});
