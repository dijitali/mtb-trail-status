/**
 * Elevation profile chart for the trail popup: one elevation line with a light
 * wash, a strip below it coloured by steepness, and a hover/keyboard readout
 * that also reports the position so the map can show it.
 */
import { profileSeries, summariseProfile, bandRuns, gradientSections, GRADIENT_BANDS, gradientBand, elevationAt } from "../lib/profile";

const SVG_NS = "http://www.w3.org/2000/svg";

// Ordinal one-hue ramp (validated: monotone lightness, light end clears 2:1 on the white popup).
export const BAND_COLORS = ["#86b6ef", "#3987e5", "#1c5cab", "#0d366b"];

const W = 300;
const H = 132;
const M = { top: 8, right: 8, bottom: 32, left: 36 };
const PLOT_H = H - M.top - M.bottom;
const STRIP_Y = M.top + PLOT_H + 4;
const STRIP_H = 6;
const SECTION_M = 50;

function svg(tag, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent?.append(node);
  return node;
}

function html(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** A "nice" tick step giving roughly `count` ticks over `span`. */
function niceStep(span, count, steps) {
  const raw = span / count;
  return steps.find((s) => s >= raw) ?? steps[steps.length - 1] * Math.ceil(raw / steps[steps.length - 1]);
}

export function formatDistance(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${Math.round(m)} m`;
}

export function formatGradient(g) {
  const v = Math.round(g);
  if (v === 0) return "0%";
  return `${Math.abs(v)}% ${v > 0 ? "up" : "down"}`;
}

/**
 * @param {{ step:number, length:number, ele:number[] }} profile stored profile
 * @param {{ direction?: "forward"|"reverse"|null, onHover?: (fraction: number|null) => void }} [options]
 *   onHover receives the position as a fraction along the way in OSM node order.
 * @returns {HTMLElement}
 */
export function createProfileChart(profile, { direction = null, onHover } = {}) {
  const series = profileSeries(profile, direction);
  const summary = summariseProfile(series, { sectionM: 100 });
  const sections = gradientSections(summary.smooth, SECTION_M);
  const runs = bandRuns(sections);
  const length = summary.length;

  const root = html("div", "profile");

  // Headline figures.
  const stats = html("dl", "profile-stats");
  for (const [label, value] of [
    ["Length", formatDistance(length)],
    ["Climb", `${Math.round(summary.climb)} m`],
    ["Descent", `${Math.round(summary.descent)} m`],
    ["Steepest", formatGradient(summary.steepest)],
  ]) {
    const item = html("div");
    if (label === "Steepest") item.title = "Steepest 100 m section";
    item.append(html("dt", null, label), html("dd", null, value));
    stats.append(item);
  }
  root.append(stats);

  // Scales.
  const yStep = niceStep(Math.max(10, summary.max - summary.min), 3, [5, 10, 20, 25, 50, 100, 200]);
  const yMin = Math.floor(summary.min / yStep) * yStep;
  const yMax = Math.max(yMin + yStep, Math.ceil(summary.max / yStep) * yStep);
  const x = (d) => M.left + (d / length) * (W - M.left - M.right);
  const y = (e) => M.top + PLOT_H - ((e - yMin) / (yMax - yMin)) * PLOT_H;

  // Readout line above the chart: a hint at rest, the cursor's values while hovering.
  const HINT = "Hover or tap the profile to find that spot on the map.";
  const readout = html("p", "profile-readout", HINT);
  readout.setAttribute("aria-live", "polite");
  root.append(readout);

  const chartWrap = html("div", "profile-chart");
  const chart = svg("svg", {
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    tabindex: 0,
    "aria-label":
      `Elevation profile, ${formatDistance(length)}${direction ? " in the riding direction" : ""}, ` +
      `from ${Math.round(series[0].ele)} m to ${Math.round(series[series.length - 1].ele)} m, ` +
      `between ${Math.round(summary.min)} and ${Math.round(summary.max)} m. Use the arrow keys to step along it.`,
  });
  chartWrap.append(chart);

  // Grid and y ticks.
  for (let v = yMin; v <= yMax + 1e-9; v += yStep) {
    svg("line", { x1: M.left, x2: W - M.right, y1: y(v), y2: y(v), class: "grid" }, chart);
    svg("text", { x: M.left - 6, y: y(v), class: "tick", "text-anchor": "end", "dominant-baseline": "middle" }, chart).textContent =
      `${v} m`;
  }

  // X ticks below the steepness strip.
  const xStep = niceStep(length, 4, [100, 200, 250, 500, 1000, 2000, 5000]);
  for (let d = 0; d <= length + 1e-9; d += xStep) {
    if (length - d < xStep * 0.35 && d !== 0) continue; // leave room for the end label
    svg("text", { x: x(d), y: H - 6, class: "tick", "text-anchor": d === 0 ? "start" : "middle" }, chart).textContent = formatDistance(d);
  }
  svg("text", { x: x(length), y: H - 6, class: "tick", "text-anchor": "end" }, chart).textContent = formatDistance(length);

  // Area wash and line.
  const pts = series.map((p) => `${x(p.d).toFixed(1)},${y(p.ele).toFixed(1)}`);
  svg("path", { d: `M${x(0)},${y(yMin)} L${pts.join(" L")} L${x(length)},${y(yMin)} Z`, class: "area" }, chart);
  svg("path", { d: `M${pts.join(" L")}`, class: "line" }, chart);

  // Steepness strip: one block per run of same-band sections, 2px surface gap between blocks.
  runs.forEach((run, i) => {
    const x0 = x(run.from) + (i === 0 ? 0 : 1);
    const x1 = x(run.to) - (i === runs.length - 1 ? 0 : 1);
    if (x1 - x0 < 0.5) return;
    svg("rect", { x: x0, y: STRIP_Y, width: x1 - x0, height: STRIP_H, rx: 1.5, fill: BAND_COLORS[run.band] }, chart);
  });

  // Hover layer.
  const cursor = svg("g", { class: "cursor", visibility: "hidden" }, chart);
  const cursorLine = svg("line", { y1: M.top, y2: M.top + PLOT_H, class: "cursor-line" }, cursor);
  const cursorDot = svg("circle", { r: 4, class: "cursor-dot" }, cursor);

  const hit = svg("rect", { x: M.left, y: 0, width: W - M.left - M.right, height: H, class: "hit" }, chart);

  let current = null;
  function sectionAt(d) {
    return sections.find((s) => d <= s.to) || sections[sections.length - 1];
  }
  function show(d) {
    current = Math.min(length, Math.max(0, d));
    const ele = elevationAt(series, current);
    const cx = x(current);
    cursorLine.setAttribute("x1", cx);
    cursorLine.setAttribute("x2", cx);
    cursorDot.setAttribute("cx", cx);
    cursorDot.setAttribute("cy", y(ele));
    cursor.setAttribute("visibility", "visible");
    const section = sectionAt(current);
    const dot = html("span", "swatch-dot");
    dot.style.background = BAND_COLORS[gradientBand(section.gradient)];
    readout.classList.add("active");
    readout.replaceChildren(
      dot,
      html("span", null, `${formatDistance(current)} in`),
      html("span", null, `${Math.round(ele)} m high`),
      html("span", null, formatGradient(section.gradient))
    );
    const fraction = current / length;
    onHover?.(direction === "reverse" ? 1 - fraction : fraction);
  }
  function hide() {
    current = null;
    cursor.setAttribute("visibility", "hidden");
    readout.classList.remove("active");
    readout.textContent = HINT;
    onHover?.(null);
  }
  function pointerDistance(event) {
    const rect = chart.getBoundingClientRect();
    const vx = ((event.clientX - rect.left) / rect.width) * W;
    return ((vx - M.left) / (W - M.left - M.right)) * length;
  }
  hit.addEventListener("pointermove", (e) => show(pointerDistance(e)));
  hit.addEventListener("pointerdown", (e) => show(pointerDistance(e)));
  // Touch lifts fire pointerleave straight away; keep a tapped position shown until the popup changes.
  hit.addEventListener("pointerleave", (e) => {
    if (e.pointerType !== "touch") hide();
  });
  chart.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const delta = (e.key === "ArrowRight" ? 1 : -1) * SECTION_M;
      show(current == null ? (delta > 0 ? 0 : length) : current + delta);
    } else if (e.key === "Escape") {
      hide();
    }
  });
  chart.addEventListener("blur", hide);
  root.append(chartWrap);

  // Steepness key.
  const key = html("div", "profile-key");
  key.append(html("span", "profile-key-title", "Steepness"));
  GRADIENT_BANDS.forEach((band, i) => {
    const item = html("span", "profile-key-item");
    const swatch = html("span", "profile-key-swatch");
    swatch.style.background = BAND_COLORS[i];
    item.append(swatch, band.label);
    key.append(item);
  });
  root.append(key);

  root.append(
    html(
      "p",
      "profile-note",
      direction ? "Shown in the riding direction." : "Two-way trail, shown in the mapped direction."
    )
  );
  return root;
}
