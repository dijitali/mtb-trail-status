/**
 * Map markers for points of interest: a round badge per type with a white
 * glyph, plus the place name underneath.
 */
import { Style, Icon, Text, Fill, Stroke } from "ol/style";

/** Badge colour and glyph (SVG in a 28×28 box, drawn in white) for each type. */
export const POI_MARKERS = {
  entrance: { color: "#263238", glyph: '<path fill="#fff" d="M13 7.5h2v13h-2z"/><path fill="#fff" d="M7.5 9h10.2l2.6 2.6-2.6 2.6H7.5z"/>' },
  parking: { color: "#1565c0", glyph: '<path fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round" d="M11.3 20.5V8h4.2a3.6 3.6 0 0 1 0 7.2h-4.2"/>' },
  shelter: {
    color: "#6d4c41",
    glyph: '<path fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" d="M7 14.2 14 8.3l7 5.9M9.4 13.2v6.6h9.2v-6.6"/>',
  },
  toilet: { color: "#546e7a", glyph: '<text x="14" y="17.6" fill="#fff" font-family="Arial, sans-serif" font-weight="700" font-size="9" text-anchor="middle">WC</text>' },
  water: { color: "#0277bd", glyph: '<path fill="#fff" d="M14 7.2s-5.2 5.8-5.2 9.1a5.2 5.2 0 0 0 10.4 0c0-3.3-5.2-9.1-5.2-9.1z"/>' },
  "bike-wash": {
    color: "#00838f",
    glyph: '<path fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" d="M8 11.5c2-1.6 4-1.6 6 0s4 1.6 6 0M8 16.5c2-1.6 4-1.6 6 0s4 1.6 6 0"/>',
  },
  info: { color: "#37474f", glyph: '<circle cx="14" cy="9.4" r="1.7" fill="#fff"/><path fill="#fff" d="M12.7 12.6h2.6v7.6h-2.6z"/>' },
  "first-aid": { color: "#c62828", glyph: '<path fill="#fff" d="M12.4 7.8h3.2v4.6h4.6v3.2h-4.6v4.6h-3.2v-4.6H7.8v-3.2h4.6z"/>' },
  viewpoint: { color: "#5d4037", glyph: '<path fill="#fff" d="M6.8 19.6 12 12.2l3 4.1 2.1-2.7 4.1 6z"/>' },
  other: { color: "#455a64", glyph: '<circle cx="14" cy="14" r="3.4" fill="#fff"/>' },
};

/** SVG data URI for a type's badge. */
export function poiIconSrc(type) {
  const { color, glyph } = POI_MARKERS[type] || POI_MARKERS.other;
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">' +
    `<circle cx="14" cy="14" r="12" fill="${color}" stroke="#fff" stroke-width="2.5"/>${glyph}</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

const cache = new Map();

// Place names appear from about zoom 14 (or when selected); further out the
// badges alone keep the overview clear for trail names, especially on phones.
const NAME_MAX_RESOLUTION = 8; // metres per pixel

/** Style function for the POI layer. */
export function poiStyle(feature, resolution) {
  const type = feature.get("type");
  const selected = Boolean(feature.get("selected"));
  const name = feature.get("name");
  const showName = selected || resolution <= NAME_MAX_RESOLUTION;
  const key = `${type}|${selected}|${name}|${showName}`;
  let styles = cache.get(key);
  if (styles) return styles;
  styles = [
    new Style({
      image: new Icon({
        src: poiIconSrc(type),
        scale: selected ? 1.15 : 0.9,
        // Badges are always drawn, and trail names steer clear of them.
        declutterMode: "obstacle",
      }),
      zIndex: 10,
    }),
    showName &&
      new Style({
      text: new Text({
        text: name,
        font: "600 12px system-ui, -apple-system, 'Segoe UI', sans-serif",
        offsetY: 22,
        fill: new Fill({ color: "#17201b" }),
        stroke: new Stroke({ color: "rgba(255, 255, 255, 0.96)", width: 4 }),
      }),
    }),
  ].filter(Boolean);
  cache.set(key, styles);
  return styles;
}
