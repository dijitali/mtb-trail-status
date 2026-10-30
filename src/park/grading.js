/**
 * Trail difficulty grading systems. A park picks one with `"grading": "<preset>"`
 * in its park.json, and can add or override grades (see README).
 *
 * Each grade: key (matched case-insensitively against the CSV `grade` column),
 * name, colour, and an optional label shown before the name ("Grade 3 · Intermediate").
 */

export const GRADING_PRESETS = {
  // New Zealand MTB track grades (Kennett Brothers / DOC).
  nz: {
    name: "New Zealand MTB track grades",
    grades: [
      { key: "1", label: "Grade 1", name: "Easiest", color: "#2ca02c" },
      { key: "2", label: "Grade 2", name: "Easy", color: "#1f77b4" },
      { key: "3", label: "Grade 3", name: "Intermediate", color: "#ff7f0e" },
      { key: "4", label: "Grade 4", name: "Advanced", color: "#d62728" },
      { key: "5", label: "Grade 5", name: "Expert", color: "#9467bd" },
      { key: "6", label: "Grade 6", name: "Extreme", color: "#000000" },
    ],
  },
  // IMBA trail difficulty rating, as used across North America.
  imba: {
    name: "IMBA trail difficulty rating",
    grades: [
      { key: "white", label: "White circle", name: "Easiest", color: "#8d9a92" },
      { key: "green", label: "Green circle", name: "Easy", color: "#2e9d3a" },
      { key: "blue", label: "Blue square", name: "More difficult", color: "#1f6fd1" },
      { key: "black", label: "Black diamond", name: "Very difficult", color: "#000000" },
      { key: "double-black", label: "Double black diamond", name: "Extremely difficult", color: "#4a148c" },
    ],
  },
  // UK and Irish trail centre colours.
  uk: {
    name: "UK trail centre grades",
    grades: [
      { key: "green", name: "Green", color: "#2e9d3a" },
      { key: "blue", name: "Blue", color: "#1f6fd1" },
      { key: "red", name: "Red", color: "#d32f2f" },
      { key: "black", name: "Black", color: "#000000" },
      { key: "orange", name: "Orange (bike park)", color: "#ef7d00" },
    ],
  },
};

export const UNGRADED = Object.freeze({ key: "", name: "Ungraded", color: "#777777", display: "Ungraded" });

/** Normalise a grade value from the CSV or config so "Grade 3", " 3" and "3" all match. */
export function normaliseGradeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^grade\s+/, "")
    .replace(/\s+/g, "-");
}

/** Text shown for a grade: "Grade 3 · Intermediate", or just the name when there's no label. */
export function gradeDisplay({ label, name }) {
  return label ? `${label} · ${name}` : name;
}
