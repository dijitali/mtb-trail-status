/**
 * Elevation profile maths. Pure functions, shared by the build script (which
 * samples elevations) and the browser (which draws the chart).
 *
 * Stored format, on each trail feature's `properties.profile`:
 *   { step: 10, length: 1234.5, ele: [52.1, 53.4, ...] }
 * Sample i sits at distance min(i * step, length) metres along the way, in OSM
 * node order. The last sample is always at `length`.
 */

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in metres between two [lon, lat] points. */
export function haversine([lon1, lat1], [lon2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Cumulative distance (metres) at each vertex of a lon/lat line. */
export function cumulativeDistances(coords) {
  const out = [0];
  for (let i = 1; i < coords.length; i++) out.push(out[i - 1] + haversine(coords[i - 1], coords[i]));
  return out;
}

/**
 * Points every `step` metres along a lon/lat line, always including both ends.
 * @returns {{ points: number[][], length: number }}
 */
export function samplePoints(coords, step) {
  const cum = cumulativeDistances(coords);
  const length = cum[cum.length - 1];
  const points = [];
  let seg = 1;
  const count = Math.ceil(length / step);
  for (let i = 0; i <= count; i++) {
    const d = Math.min(i * step, length);
    while (seg < cum.length - 1 && cum[seg] < d) seg++;
    const span = cum[seg] - cum[seg - 1];
    const t = span === 0 ? 0 : (d - cum[seg - 1]) / span;
    const [x0, y0] = coords[seg - 1];
    const [x1, y1] = coords[seg];
    points.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
  }
  return { points, length };
}

/** Round to one decimal place, which is well inside the DEM's accuracy. */
const r1 = (v) => Math.round(v * 10) / 10;

/** Build the stored profile object from sampled elevations. */
export function buildProfile(step, length, elevations) {
  return { step, length: r1(length), ele: elevations.map(r1) };
}

/**
 * Expand a stored profile into distance/elevation pairs in the direction of travel.
 * @param {{ step:number, length:number, ele:number[] }} profile
 * @param {"forward"|"reverse"|null} [direction]
 * @returns {Array<{ d: number, ele: number }>}
 */
export function profileSeries(profile, direction = null) {
  const { step, length, ele } = profile;
  const series = ele.map((e, i) => ({ d: Math.min(i * step, length), ele: e }));
  if (direction !== "reverse") return series;
  return series.reverse().map(({ d, ele: e }) => ({ d: r1(length - d), ele: e }));
}

/** Moving average over a distance window, to suppress DEM noise before computing gradients. */
export function smoothSeries(series, windowM) {
  const half = windowM / 2;
  let lo = 0;
  let hi = 0;
  let sum = 0;
  return series.map(({ d }) => {
    while (hi < series.length && series[hi].d <= d + half) sum += series[hi++].ele;
    while (series[lo].d < d - half) sum -= series[lo++].ele;
    return { d, ele: sum / (hi - lo) };
  });
}

/** Elevation at distance d by linear interpolation. */
export function elevationAt(series, d) {
  if (d <= series[0].d) return series[0].ele;
  for (let i = 1; i < series.length; i++) {
    if (series[i].d >= d) {
      const a = series[i - 1];
      const b = series[i];
      const t = b.d === a.d ? 0 : (d - a.d) / (b.d - a.d);
      return a.ele + (b.ele - a.ele) * t;
    }
  }
  return series[series.length - 1].ele;
}

/**
 * Split the trail into roughly equal sections and compute each one's gradient (%).
 * Positive is uphill in the direction of the series.
 */
export function gradientSections(series, sectionM = 50) {
  const length = series[series.length - 1].d;
  const n = Math.max(1, Math.round(length / sectionM));
  const size = length / n;
  const sections = [];
  for (let i = 0; i < n; i++) {
    const from = i * size;
    const to = (i + 1) * size;
    const rise = elevationAt(series, to) - elevationAt(series, from);
    sections.push({ from, to, gradient: size > 0 ? (rise / size) * 100 : 0 });
  }
  return sections;
}

/** Steepness bands for colouring, by absolute gradient. */
export const GRADIENT_BANDS = [
  { max: 5, label: "<5%" },
  { max: 10, label: "5–10%" },
  { max: 15, label: "10–15%" },
  { max: Infinity, label: "15%+" },
];

export function gradientBand(gradient) {
  const g = Math.abs(gradient);
  return GRADIENT_BANDS.findIndex((band) => g < band.max);
}

/** Merge consecutive sections that fall in the same band into runs. */
export function bandRuns(sections) {
  const runs = [];
  for (const s of sections) {
    const band = gradientBand(s.gradient);
    const last = runs[runs.length - 1];
    if (last && last.band === band) last.to = s.to;
    else runs.push({ from: s.from, to: s.to, band });
  }
  return runs;
}

/**
 * Headline numbers for a trail.
 * Climb and descent are summed from a smoothed series so DEM noise doesn't inflate them.
 */
export function summariseProfile(series, { smoothM = 30, sectionM = 50 } = {}) {
  const smooth = smoothSeries(series, smoothM);
  let climb = 0;
  let descent = 0;
  for (let i = 1; i < smooth.length; i++) {
    const diff = smooth[i].ele - smooth[i - 1].ele;
    if (diff > 0) climb += diff;
    else descent -= diff;
  }
  const sections = gradientSections(smooth, sectionM);
  const steepest = sections.reduce((a, b) => (Math.abs(b.gradient) > Math.abs(a.gradient) ? b : a), sections[0]);
  const eles = series.map((p) => p.ele);
  return {
    length: series[series.length - 1].d,
    climb,
    descent,
    min: Math.min(...eles),
    max: Math.max(...eles),
    steepest: steepest.gradient,
    sections,
    smooth,
  };
}
