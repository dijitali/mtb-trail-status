import { describe, it, expect } from "vitest";
import { resolveParkConfig, ParkConfigError, DEFAULTS } from "../src/park/parkConfig.js";
import { GRADING_PRESETS, normaliseGradeKey } from "../src/park/grading.js";

describe("resolveParkConfig", () => {
  it("fills in defaults for a minimal park", () => {
    const config = resolveParkConfig({ title: "Test Park" });
    expect(config.title).toBe("Test Park");
    expect(config.shortName).toBe("Test Park");
    expect(config.map).toEqual(DEFAULTS.map);
    expect(config.data).toEqual(DEFAULTS.data);
    expect(config.elevation.dataset).toBe("srtm30m");
    expect(config.grades.map((g) => g.key)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(config.grades[2].display).toBe("Grade 3 · Intermediate");
    expect(Object.isFrozen(config.map)).toBe(true);
  });

  it("merges partial sections over the defaults", () => {
    const config = resolveParkConfig({ title: "T", map: { rotation: -90 }, elevation: { dataset: "nzdem8m" } });
    expect(config.map.rotation).toBe(-90);
    expect(config.map.zoom).toBe(DEFAULTS.map.zoom);
    expect(config.elevation).toMatchObject({ dataset: "nzdem8m", step: 10, api: DEFAULTS.elevation.api });
  });

  it("can turn elevation profiles off", () => {
    expect(resolveParkConfig({ title: "T", elevation: false }).elevation).toBeNull();
  });

  it("expands every grading preset", () => {
    for (const [name, preset] of Object.entries(GRADING_PRESETS)) {
      const config = resolveParkConfig({ title: "T", grading: name });
      expect(config.grades).toHaveLength(preset.grades.length);
    }
    const uk = resolveParkConfig({ title: "T", grading: "uk" });
    expect(uk.grades.find((g) => g.key === "red").display).toBe("Red");
  });

  it("lets a park override and add grades on top of a preset", () => {
    const config = resolveParkConfig({
      title: "T",
      grading: { preset: "uk", grades: { Orange: { name: "Jump line" }, skills: { name: "Skills area", color: "#888888" } } },
    });
    expect(config.grades.find((g) => g.key === "orange")).toMatchObject({ name: "Jump line", color: "#ef7d00" });
    expect(config.grades.at(-1)).toMatchObject({ key: "skills", name: "Skills area", display: "Skills area" });
  });

  it("supports a fully custom grading system", () => {
    const config = resolveParkConfig({ title: "T", grading: { grades: { S1: { name: "Easy", color: "#00aa00" }, S2: { name: "Hard", color: "#aa0000" } } } });
    expect(config.grades.map((g) => g.key)).toEqual(["s1", "s2"]);
  });

  it("reports every problem at once, readably", () => {
    let error;
    try {
      resolveParkConfig(
        { title: "", tittle: "typo", themeColor: "green", map: { rotation: "-90", padding: [1, 2] }, grading: "swiss", data: { trails: "../secret.csv" } },
        { source: "parks/x/park.json" }
      );
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ParkConfigError);
    expect(error.message).toMatch(/^parks\/x\/park.json has \d+ problem/);
    const text = error.problems.join("\n");
    expect(text).toMatch(/unknown setting "tittle"/);
    expect(text).toMatch(/title must be/);
    expect(text).toMatch(/themeColor/);
    expect(text).toMatch(/map.rotation/);
    expect(text).toMatch(/map.padding/);
    expect(text).toMatch(/preset "swiss" is unknown/);
    expect(text).toMatch(/data.trails must be a plain file name/);
  });

  it("rejects bad grade colours", () => {
    expect(() => resolveParkConfig({ title: "T", grading: { grades: { 1: { name: "One", color: "blue" } } } })).toThrow(/hex color/);
  });
});

describe("normaliseGradeKey", () => {
  it("matches common spellings of the same grade", () => {
    expect(["3", " 3 ", "Grade 3", "grade 3"].map(normaliseGradeKey)).toEqual(["3", "3", "3", "3"]);
    expect(normaliseGradeKey("Double Black")).toBe("double-black");
    expect(normaliseGradeKey(undefined)).toBe("");
  });
});
