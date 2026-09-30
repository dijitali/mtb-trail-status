import { describe, it, expect } from "vitest";
import { arrowsAlong } from "../src/lib/arrows.js";

describe("arrowsAlong", () => {
  const line = [[0, 0], [100, 0], [100, 100]]; // 200 units long, east then north

  it("spaces arrows evenly and orients them along the line", () => {
    const arrows = arrowsAlong(line, 50, "forward");
    expect(arrows).toHaveLength(4);
    expect(arrows[0].point).toEqual([40, 0]);
    expect(arrows[0].angle).toBeCloseTo(0); // heading east
    expect(arrows[3].point).toEqual([100, 60]);
    expect(arrows[3].angle).toBeCloseTo(Math.PI / 2); // heading north
  });

  it("flips direction for reverse one-ways", () => {
    const arrows = arrowsAlong(line, 50, "reverse");
    expect(arrows[0].angle).toBeCloseTo(Math.PI);
  });

  it("returns nothing for short lines, degenerate input or huge spacing", () => {
    expect(arrowsAlong(line, 500)).toEqual([]);
    expect(arrowsAlong([[0, 0]], 10)).toEqual([]);
    expect(arrowsAlong(line, 0)).toEqual([]);
  });

  it("caps the number of arrows", () => {
    expect(arrowsAlong(line, 1, "forward", 5)).toHaveLength(5);
  });
});
