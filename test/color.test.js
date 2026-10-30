import { describe, it, expect } from "vitest";
import { mix, muted, MUTE_NEUTRAL } from "../src/lib/color.js";

describe("colour helpers", () => {
  it("mixes two colours linearly", () => {
    expect(mix("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mix("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#fff", "#000", 0.5)).toBe("#808080");
  });

  it("mutes towards the neutral while keeping the hue's lean", () => {
    const blue = muted("#1f77b4");
    expect(blue).toBe(mix("#1f77b4", MUTE_NEUTRAL, 0.5));
    const [r, , b] = [1, 3, 5].map((i) => Number.parseInt(blue.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r); // still reads blue
  });

  it("rejects malformed input", () => {
    expect(() => mix("red", "#fff", 0.5)).toThrow(/hex/);
  });
});
