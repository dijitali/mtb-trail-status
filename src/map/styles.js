/**
 * OpenLayers styling for trail lines and their labels.
 *
 * Lines and arrows are drawn by the trails layer; names are drawn by a
 * separate labels layer stacked above it (see createMap), so a name is never
 * painted over by another trail's line or arrows.
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

// Names use dark ink on a solid white halo rather than the grade colour, which
// was hard to read for orange and green over forest. They are set horizontally
// at the middle of the trail: text bent along a twisting singletrack squashes
// and overlaps its own letters at every switchback.
const LABEL_FONT = "600 13px system-ui, -apple-system, 'Segoe UI', sans-serif";
const LABEL_FONT_SELECTED = "700 14px system-ui, -apple-system, 'Segoe UI', sans-serif";
const LABEL_INK = "#17201b";
const LABEL_INK_CLOSED = "#5f6b63";
const LABEL_HALO = "rgba(255, 255, 255, 0.96)";

/** Label anchor: halfway along the trail. */
const labelAnchor = (feature) => new Point(feature.getGeometry().getCoordinateAt(0.5));

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

const labelStyleCache = new Map();

/** Style function for the labels layer: one name per trail. */
export function trailLabelStyle(feature) {
  const closed = feature.get("status") === "closed";
  const selected = Boolean(feature.get("selected"));
  const name = feature.get("name") || "";
  const key = `${name}|${closed}|${selected}`;
  let style = labelStyleCache.get(key);
  if (style) return style;
  style = new Style({
    geometry: labelAnchor,
    text: new Text({
      text: closed ? `${name} (closed)` : name,
      font: selected ? LABEL_FONT_SELECTED : LABEL_FONT,
      fill: new Fill({ color: closed ? LABEL_INK_CLOSED : LABEL_INK }),
      stroke: new Stroke({ color: LABEL_HALO, width: 4 }),
      padding: [2, 4, 2, 4], // a little breathing room between neighbouring names when decluttering
    }),
    // Selected and open trails win label collisions.
    zIndex: selected ? 2 : closed ? 0 : 1,
  });
  labelStyleCache.set(key, style);
  return style;
}

/** Line styles for a trail, cached by the properties that affect them. */
function baseStyles(feature) {
  const status = feature.get("status");
  const grade = feature.get("grade");
  const selected = Boolean(feature.get("selected"));
  const key = `${status}|${grade}|${selected}`;

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
  } else {
    styles.push(new Style({ stroke: new Stroke({ color, width: LINE_WIDTH }) }));
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
        }),
      })
  );
  arrowStyleCache.set(key, styles);
  return styles;
}

/** Style function for the trails layer: lines and direction arrows, no text. */
export function trailStyle(feature, resolution) {
  return [...baseStyles(feature), ...arrowStyles(feature, resolution)];
}

/** Drop cached arrow styles for a feature (call if its geometry changes). */
export function invalidateArrowCache() {
  arrowStyleCache.clear();
}
