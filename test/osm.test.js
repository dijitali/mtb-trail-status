import { describe, it, expect, vi } from "vitest";
import { parseOneway, wayFullToGeometry, toGeoJsonFeature, fetchWayFeatures } from "../src/lib/osm.js";

const fullJson = {
  elements: [
    { type: "node", id: 1, lat: -36.9, lon: 175.0 },
    { type: "node", id: 2, lat: -36.91, lon: 175.01 },
    { type: "node", id: 3, lat: -36.92, lon: 175.02 },
    { type: "way", id: 99, nodes: [1, 2, 3], tags: { name: "Test", oneway: "yes", surface: "dirt" } },
  ],
};

describe("parseOneway", () => {
  it("treats only explicit yes-values as one-way", () => {
    expect(parseOneway("yes")).toBe("forward");
    expect(parseOneway("1")).toBe("forward");
    expect(parseOneway("-1")).toBe("reverse");
    expect(parseOneway("no")).toBeNull(); // the old truthy check got this wrong
    expect(parseOneway(undefined)).toBeNull();
  });
});

describe("wayFullToGeometry", () => {
  it("orders coordinates by the way's node list", () => {
    const { coordinates, tags } = wayFullToGeometry(fullJson, 99);
    expect(coordinates).toEqual([[175.0, -36.9], [175.01, -36.91], [175.02, -36.92]]);
    expect(tags.name).toBe("Test");
  });
  it("throws for an unknown way", () => {
    expect(() => wayFullToGeometry(fullJson, 42)).toThrow(/42/);
  });
});

describe("toGeoJsonFeature", () => {
  it("keeps only the tags the app uses", () => {
    const feature = toGeoJsonFeature(99, wayFullToGeometry(fullJson, 99));
    expect(feature).toEqual({
      type: "Feature",
      id: 99,
      properties: { osmId: 99, osmName: "Test", oneway: "forward", surface: "dirt" },
      geometry: { type: "LineString", coordinates: [[175.0, -36.9], [175.01, -36.91], [175.02, -36.92]] },
    });
  });
});

describe("fetchWayFeatures", () => {
  it("fetches each way and collects failures without aborting", async () => {
    const fetch = vi.fn(async (url) => {
      if (url.includes("/way/99/")) return { ok: true, json: async () => fullJson };
      return { ok: false, status: 404 };
    });
    const { features, errors } = await fetchWayFeatures([404, 99], { fetch, apiBase: "https://osm.test/api/0.6" });
    expect(fetch).toHaveBeenCalledWith("https://osm.test/api/0.6/way/99/full.json", expect.anything());
    expect(features.map((f) => f.id)).toEqual([99]);
    expect(errors).toHaveLength(1);
    expect(errors[0].wayId).toBe(404);
    expect(errors[0].error.message).toMatch(/404/);
  });
});
