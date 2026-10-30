import { describe, it, expect } from "vitest";
import {
  haversine,
  samplePoints,
  buildProfile,
  profileSeries,
  smoothSeries,
  gradientSections,
  gradientBand,
  bandRuns,
  summariseProfile,
  elevationAt,
} from "../src/lib/profile.js";

// 0.001° of latitude is ~111.2 m everywhere.
const north = (metres) => [175, -36.9 + metres / 111195];

describe("distances and sampling", () => {
  it("measures great-circle distance", () => {
    expect(haversine(north(0), north(1000))).toBeCloseTo(1000, 0);
  });

  it("samples at a fixed step and always includes the end", () => {
    const { points, length } = samplePoints([north(0), north(25)], 10);
    expect(length).toBeCloseTo(25, 1);
    expect(points).toHaveLength(4); // 0, 10, 20, 25
    expect(haversine(points[0], points[1])).toBeCloseTo(10, 1);
    expect(points[3][1]).toBeCloseTo(north(25)[1], 9);
  });

  it("follows bends in the line", () => {
    const corner = [north(0), north(10), [175 + 10 / (111195 * Math.cos((36.9 * Math.PI) / 180)), north(10)[1]]];
    const { points, length } = samplePoints(corner, 5);
    expect(length).toBeCloseTo(20, 0);
    expect(points[2][1]).toBeCloseTo(north(10)[1], 9); // the corner itself
  });
});

describe("profile series", () => {
  const profile = buildProfile(10, 25.04, [100, 101.04, 103, 104]);

  it("rounds stored values", () => {
    expect(profile).toEqual({ step: 10, length: 25, ele: [100, 101, 103, 104] });
  });

  it("expands to distance/elevation pairs", () => {
    expect(profileSeries(profile)).toEqual([
      { d: 0, ele: 100 },
      { d: 10, ele: 101 },
      { d: 20, ele: 103 },
      { d: 25, ele: 104 },
    ]);
  });

  it("reverses for one-way trails ridden against the mapped direction", () => {
    expect(profileSeries(profile, "reverse")).toEqual([
      { d: 0, ele: 104 },
      { d: 5, ele: 103 },
      { d: 15, ele: 101 },
      { d: 25, ele: 100 },
    ]);
  });

  it("interpolates elevation between samples", () => {
    expect(elevationAt(profileSeries(profile), 15)).toBeCloseTo(102);
    expect(elevationAt(profileSeries(profile), 99)).toBe(104);
  });
});

describe("gradients and summary", () => {
  // 200 m climbing at 10%, then 100 m descending at 20%.
  const series = [];
  for (let d = 0; d <= 300; d += 10) series.push({ d, ele: d <= 200 ? 50 + d * 0.1 : 70 - (d - 200) * 0.2 });

  it("computes section gradients", () => {
    const sections = gradientSections(series, 50);
    expect(sections).toHaveLength(6);
    expect(sections[0].gradient).toBeCloseTo(10);
    expect(sections[5].gradient).toBeCloseTo(-20);
  });

  it("bands by absolute steepness", () => {
    expect([0, 4.9, 5, -9, 12, -30].map(gradientBand)).toEqual([0, 0, 1, 1, 2, 3]);
  });

  it("merges neighbouring sections in the same band", () => {
    const runs = bandRuns(gradientSections(series, 50));
    expect(runs.map((r) => r.band)).toEqual([2, 3]); // 10% band, then 15%+ band
    expect(runs[0].from).toBe(0);
    expect(runs[1].to).toBe(300);
  });

  it("summarises climb, descent and the steepest section", () => {
    const s = summariseProfile(series, { smoothM: 0.001, sectionM: 100 });
    expect(s.length).toBe(300);
    expect(s.climb).toBeCloseTo(20);
    expect(s.descent).toBeCloseTo(20);
    expect(s.min).toBe(50);
    expect(s.max).toBe(70);
    expect(s.steepest).toBeCloseTo(-20);
  });

  it("smoothing removes single-sample noise", () => {
    const noisy = series.map((p, i) => ({ ...p, ele: p.ele + (i === 5 ? 6 : 0) }));
    const raw = summariseProfile(noisy, { smoothM: 0.001 });
    const smooth = summariseProfile(noisy, { smoothM: 30 });
    expect(raw.climb).toBeGreaterThan(smooth.climb);
    expect(smoothSeries(noisy, 30)[5].ele).toBeLessThan(noisy[5].ele);
  });
});
