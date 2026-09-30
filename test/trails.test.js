import { describe, it, expect } from "vitest";
import { parseTrailsCsv, normaliseStatus, joinTrailsWithGeometry } from "../src/lib/trails.js";

const csv = `name,osmId,status,comments,grade
Horse Track,434871453,Open,Watch out for horses!,2
Yippi Ki Yay, 434871466,Closed,Closed for logging,4
`;

describe("normaliseStatus", () => {
  it("maps common spellings to open/closed", () => {
    expect(normaliseStatus("Open")).toBe("open");
    expect(normaliseStatus(" CLOSED ")).toBe("closed");
    expect(normaliseStatus("shut")).toBe("closed");
  });
  it("falls back to unknown", () => {
    expect(normaliseStatus("")).toBe("unknown");
    expect(normaliseStatus(undefined)).toBe("unknown");
    expect(normaliseStatus("Caution")).toBe("unknown");
  });
});

describe("parseTrailsCsv", () => {
  it("parses rows and normalises values", () => {
    const { trails, errors } = parseTrailsCsv(csv);
    expect(errors).toEqual([]);
    expect(trails).toHaveLength(2);
    expect(trails[0]).toEqual({
      osmId: 434871453,
      name: "Horse Track",
      status: "open",
      statusLabel: "Open",
      grade: "2",
      comments: "Watch out for horses!",
    });
    // leading space in the osmId cell is tolerated
    expect(trails[1].osmId).toBe(434871466);
    expect(trails[1].status).toBe("closed");
  });

  it("accepts differently cased / spaced headers", () => {
    const { trails } = parseTrailsCsv("Name,OSM ID,Status\nA,1,Open\n");
    expect(trails[0]).toMatchObject({ osmId: 1, name: "A", status: "open" });
  });

  it("reports rows with bad ids instead of silently dropping them", () => {
    const { trails, errors } = parseTrailsCsv("name,osmId,status\nGood,10,Open\nBad,abc,Open\nMissing,,Open\n");
    expect(trails.map((t) => t.osmId)).toEqual([10]);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/line 3/);
    expect(errors[1]).toMatch(/line 4/);
  });

  it("applies defaults for missing optional fields", () => {
    const { trails } = parseTrailsCsv("osmId\n5\n");
    expect(trails[0]).toMatchObject({ name: "Unnamed trail", status: "unknown", statusLabel: "Unknown", grade: "", comments: "" });
  });
});

describe("joinTrailsWithGeometry", () => {
  const geometry = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: 434871453,
        properties: { osmId: 434871453, osmName: "Horse Track", oneway: null },
        geometry: { type: "LineString", coordinates: [[175, -36], [175.1, -36.1]] },
      },
    ],
  };

  it("merges CSV properties onto cached geometry and reports missing trails", () => {
    const { trails } = parseTrailsCsv(csv);
    const { features, missing } = joinTrailsWithGeometry(trails, geometry);
    expect(features).toHaveLength(1);
    expect(features[0].id).toBe(434871453);
    expect(features[0].properties).toMatchObject({ name: "Horse Track", status: "open", grade: "2", osmName: "Horse Track" });
    expect(features[0].geometry.coordinates).toHaveLength(2);
    expect(missing.map((t) => t.osmId)).toEqual([434871466]);
  });

  it("handles a missing or empty cache", () => {
    const { trails } = parseTrailsCsv(csv);
    expect(joinTrailsWithGeometry(trails, undefined).missing).toHaveLength(2);
    expect(joinTrailsWithGeometry(trails, { features: [] }).features).toHaveLength(0);
  });
});
