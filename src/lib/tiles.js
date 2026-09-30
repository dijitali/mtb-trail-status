/**
 * Slippy-map tile arithmetic for prefetching an area for offline use.
 * Pure functions, shared with tests.
 */

/** @param {number} lon @param {number} lat @param {number} z */
export function lonLatToTile(lon, lat, z) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  const clamp = (v) => Math.min(n - 1, Math.max(0, v));
  return { x: clamp(x), y: clamp(y) };
}

/**
 * Tile ranges covering a lon/lat bounding box for each zoom level.
 * @param {[number, number, number, number]} bbox [west, south, east, north]
 * @param {number} minZoom
 * @param {number} maxZoom
 * @returns {Array<{z:number, xMin:number, xMax:number, yMin:number, yMax:number}>}
 */
export function tileRangesForBbox([west, south, east, north], minZoom, maxZoom) {
  const ranges = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const a = lonLatToTile(west, north, z);
    const b = lonLatToTile(east, south, z);
    ranges.push({
      z,
      xMin: Math.min(a.x, b.x),
      xMax: Math.max(a.x, b.x),
      yMin: Math.min(a.y, b.y),
      yMax: Math.max(a.y, b.y),
    });
  }
  return ranges;
}

export function countTiles(ranges) {
  return ranges.reduce((sum, r) => sum + (r.xMax - r.xMin + 1) * (r.yMax - r.yMin + 1), 0);
}

/**
 * Expand tile ranges into concrete URLs.
 * @param {ReturnType<typeof tileRangesForBbox>} ranges
 * @param {string} template e.g. "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
 */
export function tileUrls(ranges, template) {
  const urls = [];
  for (const { z, xMin, xMax, yMin, yMax } of ranges) {
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        urls.push(template.replace("{z}", z).replace("{x}", x).replace("{y}", y));
      }
    }
  }
  return urls;
}

/** Grow a bbox by a fraction of its size on every side, so the map has context around the trails. */
export function padBbox([west, south, east, north], fraction) {
  const dx = (east - west) * fraction;
  const dy = (north - south) * fraction;
  return [west - dx, south - dy, east + dx, north + dy];
}

/**
 * Tile ranges to store for offline use. Two tiers keep the tile count sane:
 * the whole fitted overview at low zooms (what the rider sees first), and
 * only the padded trail area at high zooms (where tiles are small).
 *
 * @param {object} args
 * @param {[number,number,number,number]} args.overviewBbox lon/lat bounds of the fitted overview viewport
 * @param {number} args.overviewZoom zoom level of that overview
 * @param {[number,number,number,number]} args.trailsBbox lon/lat bounds of the trails
 * @param {number} args.minZoom
 * @param {number} args.maxZoom
 * @param {number} [args.trailPadding] fraction to pad the trail bbox by
 */
export function offlineTileRanges({ overviewBbox, overviewZoom, trailsBbox, minZoom, maxZoom, trailPadding = 0.3 }) {
  const overviewMax = Math.min(maxZoom, Math.floor(overviewZoom) + 1);
  const ranges = tileRangesForBbox(overviewBbox, minZoom, overviewMax);
  if (overviewMax < maxZoom) {
    ranges.push(...tileRangesForBbox(padBbox(trailsBbox, trailPadding), overviewMax + 1, maxZoom));
  }
  return ranges;
}
