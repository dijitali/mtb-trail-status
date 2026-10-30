/**
 * Elevation lookup via an OpenTopoData-compatible API
 * (https://www.opentopodata.org). Used by the build script only.
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fill null gaps by linear interpolation; ends take the nearest known value. */
export function fillGaps(values) {
  const known = values.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0);
  if (!known.length) throw new Error("No elevation data for any point (outside the dataset's coverage?)");
  return values.map((v, i) => {
    if (v != null) return v;
    const next = known.find((k) => k > i);
    const prev = [...known].reverse().find((k) => k < i);
    if (prev == null) return values[next];
    if (next == null) return values[prev];
    return values[prev] + ((values[next] - values[prev]) * (i - prev)) / (next - prev);
  });
}

/**
 * Look up elevations for [lon, lat] points.
 * The public OpenTopoData API allows 100 locations per request and 1 request a second.
 *
 * @param {number[][]} points
 * @param {{ api: string, dataset: string, fetch?: typeof fetch, batchSize?: number, delayMs?: number,
 *           onProgress?: (done: number, total: number) => void }} options
 * @returns {Promise<number[]>} metres, gaps interpolated
 */
export async function fetchElevations(points, options) {
  const { api, dataset, batchSize = 100, delayMs = 1100, onProgress } = options;
  const doFetch = options.fetch || globalThis.fetch;
  const out = [];
  for (let start = 0; start < points.length; start += batchSize) {
    if (start > 0 && delayMs) await sleep(delayMs);
    const batch = points.slice(start, start + batchSize);
    const locations = batch.map(([lon, lat]) => `${lat.toFixed(6)},${lon.toFixed(6)}`).join("|");
    const url = `${api.replace(/\/$/, "")}/${dataset}?locations=${locations}`;
    const response = await doFetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Elevation API ${response.status} for ${dataset}`);
    const json = await response.json();
    if (json.status && json.status !== "OK") throw new Error(`Elevation API: ${json.error || json.status}`);
    if (!Array.isArray(json.results) || json.results.length !== batch.length) {
      throw new Error("Elevation API returned an unexpected number of results");
    }
    out.push(...json.results.map((r) => (typeof r.elevation === "number" ? r.elevation : null)));
    onProgress?.(Math.min(start + batchSize, points.length), points.length);
  }
  return fillGaps(out);
}
