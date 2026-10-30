import { describe, it, expect } from "vitest";
import { parsePoisCsv, normalisePoiType, POI_TYPES } from "../src/lib/pois.js";
import { POI_MARKERS } from "../src/map/poiStyles.js";

describe("normalisePoiType", () => {
  it("accepts canonical names and common aliases", () => {
    expect(normalisePoiType("Entrance")).toBe("entrance");
    expect(normalisePoiType("trailhead")).toBe("entrance");
    expect(normalisePoiType("Car park")).toBe("parking");
    expect(normalisePoiType("first_aid")).toBe("first-aid");
    expect(normalisePoiType("Drinking water")).toBe("water");
    expect(normalisePoiType("spaceport")).toBeNull();
  });

  it("has a map marker for every type", () => {
    expect(Object.keys(POI_MARKERS).sort()).toEqual(Object.keys(POI_TYPES).sort());
  });
});

describe("parsePoisCsv", () => {
  it("parses places with descriptions containing commas", () => {
    const { pois, errors } = parsePoisCsv(
      'name,type,lat,lon,description\nRewa Road entrance,entrance,-36.88490,175.04038,"Gate, then the track"\nShelter,shelter,-36.9077,175.04661,\n'
    );
    expect(errors).toEqual([]);
    expect(pois).toEqual([
      { id: "poi-1", name: "Rewa Road entrance", type: "entrance", lat: -36.8849, lon: 175.04038, description: "Gate, then the track" },
      { id: "poi-2", name: "Shelter", type: "shelter", lat: -36.9077, lon: 175.04661, description: "" },
    ]);
  });

  it("accepts latitude/longitude header spellings", () => {
    const { pois } = parsePoisCsv("Name,Type,Latitude,Longitude\nCar park,parking,-36.9,175.0\n");
    expect(pois[0]).toMatchObject({ type: "parking", lat: -36.9, lon: 175 });
  });

  it("reports unusable rows and keeps unknown types as general places", () => {
    const { pois, errors } = parsePoisCsv("name,type,lat,lon\n,entrance,1,2\nNo coords,entrance,,\nMystery,spaceport,-36.9,175\n");
    expect(pois).toHaveLength(1);
    expect(pois[0]).toMatchObject({ name: "Mystery", type: "other" });
    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatch(/line 2: missing name/);
    expect(errors[1]).toMatch(/line 3 \("No coords"\)/);
    expect(errors[2]).toMatch(/unknown type "spaceport"/);
  });
});

describe("typeLabelFor", async () => {
  const { typeLabelFor } = await import("../src/lib/pois.js");
  it("omits the type when the name already says it", () => {
    expect(typeLabelFor({ name: "Rewa Road entrance", type: "entrance" })).toBeNull();
    expect(typeLabelFor({ name: "Shelter", type: "shelter" })).toBeNull();
    expect(typeLabelFor({ name: "Top container", type: "shelter" })).toBe("Shelter");
  });
});
