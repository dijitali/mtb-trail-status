/**
 * Get color based on Kennett Brothers grade
 * @param {string|number} grade - The trail grade
 * @returns {string} - Color hex code
 */
export function getGradeColor(grade) {
  switch (parseInt(grade)) {
    case 1:
      return "#2ca02c"; // Green - Grade 1 (Easiest)
    case 2:
      return "#1f77b4"; // Blue - Grade 2 (Easy)
    case 3:
      return "#ff7f0e"; // Orange - Grade 3 (Intermediate)
    case 4:
      return "#d62728"; // Red - Grade 4 (Advanced)
    case 5:
      return "#9467bd"; // Purple - Grade 5 (Expert)
    case 6:
      return "#000000"; // Black - Grade 6 (Extreme)
    default:
      return "#777777"; // Gray for unknown
  }
}

/**
 * Get class name based on grade
 * @param {string|number} grade - The trail grade
 * @returns {string} - CSS class name
 */
export function getGradeClass(grade) {
  const gradeNum = parseInt(grade);
  if (gradeNum >= 1 && gradeNum <= 6) {
    return `grade-${gradeNum}`;
  }
  return "";
}

/**
 * Normalize CSV data to handle case sensitivity
 * @param {Array} data - Raw CSV data
 * @returns {Array} - Normalized data
 */
export function normalizeData(data) {
  return data.map((row) => {
    const normalizedRow = {};
    Object.keys(row).forEach((key) => {
      // Convert all keys to lowercase for comparison
      const lowerKey = key.toLowerCase().trim();
      normalizedRow[lowerKey] = row[key];

      // Also keep the original key for backward compatibility
      normalizedRow[key] = row[key];
    });
    return normalizedRow;
  });
}
