/**
 * @file A service for fetching data from the Overpass API efficiently.
 */

const OVERPASS_API_ENDPOINT = "https://overpass-api.de/api/interpreter";

/**
 * Fetches multiple ways from the Overpass API in a single batch request.
 * This is much more efficient than fetching them one by one.
 *
 * @param {number[]} wayIds An array of OpenStreetMap way IDs.
 * @returns {Promise<object[]>} A promise that resolves to an array of way elements from the API.
 */
export async function getWaysByIds(wayIds) {
  if (!wayIds || wayIds.length === 0) {
    return [];
  }

  // For very large lists, you might split `wayIds` into chunks of ~1000
  // and make a few batch requests instead of one giant one.

  // Build a single query for all way IDs.
  const wayQueries = wayIds.map((id) => `way(${id});`).join("\n  ");
  const query = `
    [out:json][timeout:30];
    (
      ${wayQueries}
    );
    out geom;
  `;

  try {
    const response = await fetch(OVERPASS_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        "Overpass API request failed:",
        response.status,
        response.statusText,
        errorBody
      );
      throw new Error(`Overpass API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.elements || [];
  } catch (error) {
    console.error("Error fetching ways by ID:", error);
    // Depending on requirements, you might want to re-throw or return an empty array.
    throw error;
  }
}

/**
 * Fetches all ways that match a certain criteria within a given bounding box.
 *
 * @param {{south: number, west: number, north: number, east: number}} bbox The bounding box.
 * @param {string} mainTag The primary tag to query (e.g., 'highway', 'building').
 * @param {string} [tagValue='*'] The value of the tag to query. Defaults to all values.
 * @returns {Promise<object[]>} A promise that resolves to an array of way elements.
 */
export async function getWaysInBoundingBox(bbox, mainTag, tagValue = "*") {
  const bboxString = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const tagFilter =
    tagValue === "*" ? `[${mainTag}]` : `[${mainTag}=${tagValue}]`;

  const query = `
    [out:json][timeout:30];
    way${tagFilter}(${bboxString});
    out geom;
  `;

  try {
    const response = await fetch(OVERPASS_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        "Overpass API request failed:",
        response.status,
        response.statusText,
        errorBody
      );
      throw new Error(`Overpass API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.elements || [];
  } catch (error) {
    console.error("Error fetching ways in bounding box:", error);
    throw error;
  }
}
