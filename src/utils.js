/**
 * Normalize CSV data to handle case sensitivity
 * Converts all keys to lowercase.
 * @param {Array} data - Raw CSV data
 * @returns {Array} - Normalized data
 */
export function normalizeData(data) {
  return data.map((row) => {
    const normalizedRow = {};
    for (const key in row) {
      if (Object.prototype.hasOwnProperty.call(row, key)) {
        normalizedRow[key.toLowerCase().trim()] = row[key];
      }
    }
    return normalizedRow;
  });
}
