import { Map, View, Overlay } from "ol";
import { OSM } from "ol/source";
import { Tile as TileLayer, Vector as VectorLayer } from "ol/layer";
import { Vector as VectorSource } from "ol/source";
import { fromLonLat } from "ol/proj";
import { Style, Stroke, Text, Fill } from "ol/style";
import { config, getGradeDetails } from "./config";

// Vector source to hold all trail features
export const trailsSource = new VectorSource();

/**
 * Initialize the map with OpenLayers
 * @returns {Map} - OpenLayers Map instance
 */
export function initMap() {
  // Create popup overlay
  const container = document.getElementById("popup");
  const content = document.getElementById("popup-content");
  const closer = document.getElementById("popup-closer");

  const overlay = new Overlay({
    element: container,
    autoPan: {
      // Updated to OL6+ syntax for autoPan options
      animation: {
        duration: 250,
      },
    },
  });

  // Add a click handler to hide the popup
  closer.onclick = function () {
    overlay.setPosition(undefined);
    closer.blur();
    return false;
  };

  // Create the trails layer with styling
  const trailsLayer = new VectorLayer({
    source: trailsSource,
    style: function (feature) {
      // Get trail properties
      const status = feature.get("status");
      const grade = feature.get("grade");
      const name = feature.get("name");

      // Determine line color based on status from config
      const statusLower = status.toLowerCase();
      const lineColor =
        config.trailLineStyles.statusColors[statusLower] ||
        config.trailLineStyles.statusColors.unknown;

      // Get grade details for label color
      const gradeInfo = getGradeDetails(grade);

      // Create style for the line
      const lineStyle = new Style({
        stroke: new Stroke({
          color: lineColor,
          width: config.trailLineStyles.lineWidth,
        }),
      });

      // Create style for the text label
      const textStyle = new Style({
        text: new Text({
          text: name,
          font: config.trailLabelStyles.font,
          fill: new Fill({
            color: gradeInfo.color, // Use color from configured grading system
          }),
          stroke: new Stroke({
            color: config.trailLabelStyles.strokeColor,
            width: config.trailLabelStyles.strokeWidth,
          }),
          placement: config.trailLabelStyles.placement,
          overflow: config.trailLabelStyles.overflow,
          offsetY: config.trailLabelStyles.offsetY,
        }),
      });

      // Return an array of styles
      return [lineStyle, textStyle];
    },
  });

  // Create the map
  const map = new Map({
    target: "map",
    layers: [
      new TileLayer({
        source: new OSM(),
      }),
      trailsLayer,
    ],
    overlays: [overlay],
    view: new View({
      center: fromLonLat(config.mapDefaults.center),
      zoom: config.mapDefaults.zoom,
      // Convert degrees from config to radians for OpenLayers
      rotation: (config.mapDefaults.rotation * Math.PI) / 180,
    }),
  });

  // Add click interaction to show popup with trail info
  map.on("click", function (evt) {
    const feature = map.forEachFeatureAtPixel(evt.pixel, function (feature) {
      return feature;
    });

    if (feature) {
      const name = feature.get("name");
      const status = feature.get("status");
      const grade = feature.get("grade");
      const comments = feature.get("comments");
      const gradeInfo = getGradeDetails(grade);
      const statusLower = status.toLowerCase();

      const statusClass =
        config.popup.statusClasses[statusLower] ||
        config.popup.statusClasses.unknown;

      content.innerHTML = `
        <h3>${name}</h3>
        <p>Status: <span class="${statusClass}">${status}</span></p>
        <p>Grade: <span class="${gradeInfo.className}" style="color: ${
        gradeInfo.color
      };">
          ${gradeInfo.name} (Grade ${grade})
        </span></p>
        ${comments ? `<p>${comments}</p>` : ""}
      `;

      overlay.setPosition(evt.coordinate);
    }
  });

  // Change cursor when hovering over a feature
  map.on("pointermove", function (e) {
    if (e.dragging) return;

    const pixel = map.getEventPixel(e.originalEvent);
    const hit = map.hasFeatureAtPixel(pixel);

    map.getTargetElement().style.cursor = hit ? "pointer" : "";
  });

  return map;
}
