import { describe, it, expect } from "vitest";
import { lonLatToTile, tileRangesForBbox, countTiles, tileUrls, padBbox, offlineTileRanges } from "../src/lib/tiles.js";

describe("tile maths", () => {
  it("converts lon/lat to tile indices", () => {
    expect(lonLatToTile(0, 0, 1)).toEqual({ x: 1, y: 1 });
    // Whitford Forest, Auckland at z13
    expect(lonLatToTile(175.03, -36.93, 13)).toEqual({ x: 8078, y: 5001 });
  });

  it("builds ranges per zoom and counts them", () => {
    const ranges = tileRangesForBbox([175.0, -36.95, 175.06, -36.88], 12, 14);
    expect(ranges.map((r) => r.z)).toEqual([12, 13, 14]);
    for (const r of ranges) {
      expect(r.xMax).toBeGreaterThanOrEqual(r.xMin);
      expect(r.yMax).toBeGreaterThanOrEqual(r.yMin);
    }
    const count = countTiles(ranges);
    expect(count).toBe(tileUrls(ranges, "{z}/{x}/{y}").length);
    expect(count).toBeLessThan(40);
  });

  it("formats tile URLs from a template", () => {
    const urls = tileUrls([{ z: 3, xMin: 1, xMax: 1, yMin: 2, yMax: 3 }], "https://t/{z}/{x}/{y}.png");
    expect(urls).toEqual(["https://t/3/1/2.png", "https://t/3/1/3.png"]);
  });

  it("pads a bbox symmetrically", () => {
    expect(padBbox([0, 0, 10, 20], 0.1)).toEqual([-1, -2, 11, 22]);
  });
});

describe("offlineTileRanges", () => {
  const trailsBbox = [175.02, -36.92, 175.05, -36.89]; // ~3 km square
  const overviewBbox = [174.93, -36.96, 175.14, -36.85]; // fitted viewport, wider than the trails

  it("covers the overview at low zooms and only the trail area above it", () => {
    const ranges = offlineTileRanges({ overviewBbox, overviewZoom: 13.4, trailsBbox, minZoom: 12, maxZoom: 16 });
    expect(ranges.map((r) => r.z)).toEqual([12, 13, 14, 15, 16]);
    expect(ranges[2]).toEqual(tileRangesForBbox(overviewBbox, 14, 14)[0]); // z14 still uses the overview bounds
    const wideAt15 = tileRangesForBbox(overviewBbox, 15, 15)[0];
    expect(ranges[3].xMax - ranges[3].xMin).toBeLessThan(wideAt15.xMax - wideAt15.xMin); // z15 narrows to the trails
    expect(countTiles(ranges)).toBeLessThan(400);
  });

  it("does not exceed maxZoom when the overview is already zoomed in", () => {
    const ranges = offlineTileRanges({ overviewBbox, overviewZoom: 16.5, trailsBbox, minZoom: 12, maxZoom: 16 });
    expect(ranges.map((r) => r.z)).toEqual([12, 13, 14, 15, 16]);
  });
});
