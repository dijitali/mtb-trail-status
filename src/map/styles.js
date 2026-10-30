/**
 * OpenLayers styling for trail features.
 *
 * Styles are cached: OL calls the style function on every render frame for
 * every feature, so allocating new Style objects each time is a common
 * performance trap.
 */
import { Style, Stroke, Text, Fill, Icon } from "ol/style";
import { Point } from "ol/geom";
import { getGrade } from "../config";
import { arrowsAlong } from "../lib/arrows";
import { muted } from "../lib/color";

const LINE_WIDTH = 4;
// Closed trails keep their grade hue but faded, dashed over a pale casing,
// so closure reads at a glance without hiding the grade.
const CLOSED_DASH_PATTERN = [9, 6];
const CLOSED_CASING = "rgba(255, 255, 255, 0.85)";
const ARROW_SPACING_PX = 90;
const ARROW_MAX_RESOLUTION = 4; // metres/pixel, roughly zoom 15+. Arrows are noise when zoomed out.
const HALO_WIDTH = 14;
const LABEL_FONT = "bold 12px system-ui, sans-serif";

// Right-pointing chevron; rotated to follow the line direction.
const ARROW_SRC =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">' +
      '<path d="M4 2 L11 8 L4 14" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M4 2 L11 8 L4 14" fill="none" stroke="#333333" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg>"
  );

const baseStyleCache = new Map();
const arrowStyleCache = new Map();

function labelStyle(name, color) {
  return new Style({
    text: new Text({
      text: name,
      font: LABEL_FONT,
      placement: "line",
      overflow: true, // sinuous trails rarely "fit" a label; declutter handles overlaps
      declutterMode: "declutter",
      fill: new Fill({ color }),
      stroke: new Stroke({ color: "rgba(255,255,255,0.95)", width: 3 }),
    }),
  });
}

/** Line + label styles for a trail, cached by the properties that affect them. */
function baseStyles(feature) {
  const name = feature.get("name") || "";
  const status = feature.get("status");
  const grade = feature.get("grade");
  const selected = Boolean(feature.get("selected"));
  const key = `${status}|${grade}|${selected}|${name}`;

  let styles = baseStyleCache.get(key);
  if (styles) return styles;

  const { color } = getGrade(grade);
  styles = [];
  if (selected) {
    styles.push(new Style({ stroke: new Stroke({ color: "rgba(0, 120, 255, 0.35)", width: HALO_WIDTH }) }));
  }
  if (status === "closed") {
    const faded = muted(color);
    styles.push(
      new Style({ stroke: new Stroke({ color: CLOSED_CASING, width: LINE_WIDTH + 2 }) }),
      new Style({ stroke: new Stroke({ color: faded, width: LINE_WIDTH, lineDash: CLOSED_DASH_PATTERN, lineCap: "butt" }) })
    );
    styles.push(labelStyle(`${name} (closed)`, muted(color, 0.35)));
  } else {
    styles.push(new Style({ stroke: new Stroke({ color, width: LINE_WIDTH }) }));
    styles.push(labelStyle(name, color));
  }
  baseStyleCache.set(key, styles);
  return styles;
}

/** Direction arrows for one-way trails, spaced in screen pixels so density is stable across zooms. */
function arrowStyles(feature, resolution) {
  const oneway = feature.get("oneway");
  if (!oneway || feature.get("status") === "closed" || resolution > ARROW_MAX_RESOLUTION) return [];

  const key = `${feature.getId()}|${resolution.toPrecision(3)}`;
  let styles = arrowStyleCache.get(key);
  if (styles) return styles;

  const coords = feature.getGeometry().getCoordinates();
  styles = arrowsAlong(coords, ARROW_SPACING_PX * resolution, oneway).map(
    ({ point, angle }) =>
      new Style({
        geometry: new Point(point),
        image: new Icon({
          src: ARROW_SRC,
          anchor: [0.5, 0.5],
          rotateWithView: true,
          rotation: -angle, // OL rotation is clockwise; angle is counter-clockwise
          scale: 0.9,
          declutterMode: "obstacle", // labels avoid arrows, arrows are always drawn
        }),
      })
  );
  arrowStyleCache.set(key, styles);
  return styles;
}

/** Style function for the trails vector layer. */
export function trailStyle(feature, resolution) {
  return [...baseStyles(feature), ...arrowStyles(feature, resolution)];
}

/** Drop cached arrow styles for a feature (call if its geometry changes). */
export function invalidateArrowCache() {
  arrowStyleCache.clear();
}
