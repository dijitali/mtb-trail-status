import { describe, it, expect } from "vitest";
import { lonLatToTile, tileRangesForBbox, countTiles, tileUrls, padBbox } from "../src/lib/tiles.js";

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
