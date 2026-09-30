/**
 * Place direction arrows evenly along a polyline.
 * Pure geometry (works on projected coordinates), no OpenLayers dependency.
 */

/**
 * @param {number[][]} coords projected [x, y] vertices of the line
 * @param {number} spacing desired distance between arrows in coordinate units
 * @param {"forward"|"reverse"} direction travel direction relative to vertex order
 * @param {number} [maxArrows]
 * @returns {Array<{ point: number[], angle: number }>} angle in radians, counter-clockwise from +x
 */
export function arrowsAlong(coords, spacing, direction = "forward", maxArrows = 40) {
  if (coords.length < 2 || spacing <= 0) return [];

  const segments = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const [x0, y0] = coords[i - 1];
    const [x1, y1] = coords[i];
    const length = Math.hypot(x1 - x0, y1 - y0);
    segments.push({ start: total, length, x0, y0, dx: x1 - x0, dy: y1 - y0 });
    total += length;
  }

  const count = Math.min(maxArrows, Math.floor(total / spacing));
  if (count === 0) return [];

  const arrows = [];
  let seg = 0;
  for (let i = 1; i <= count; i++) {
    const target = (total * i) / (count + 1);
    while (seg < segments.length - 1 && segments[seg].start + segments[seg].length < target) seg++;
    const s = segments[seg];
    const t = s.length === 0 ? 0 : (target - s.start) / s.length;
    let angle = Math.atan2(s.dy, s.dx);
    if (direction === "reverse") angle += Math.PI;
    arrows.push({ point: [s.x0 + s.dx * t, s.y0 + s.dy * t], angle });
  }
  return arrows;
}
