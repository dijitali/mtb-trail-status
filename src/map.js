import { Map, View, Overlay } from "ol";
import { OSM } from "ol/source";
import { Tile as TileLayer, Vector as VectorLayer } from "ol/layer";
import { Vector as VectorSource } from "ol/source";
import { fromLonLat } from "ol/proj";
import { Style, Stroke, Text, Fill } from "ol/style";
import { getGradeColor, getGradeClass } from "./utils";

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
    autoPan: true,
    autoPanAnimation: {
      duration: 250,
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

      // Determine line color based on status
      const color = status.toLowerCase() === "open" ? "green" : "red";

      // Create style for the line
      const lineStyle = new Style({
        stroke: new Stroke({
          color: color,
          width: 4,
        }),
      });

      // Create style for the text label
      const textStyle = new Style({
        text: new Text({
          text: name,
          font: "bold 12px Arial",
          fill: new Fill({
            color: getGradeColor(grade),
          }),
          stroke: new Stroke({
            color: "white",
            width: 3,
          }),
          placement: "line",
          overflow: true,
          offsetY: 0,
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
      center: fromLonLat([175.029, -36.931]),
      zoom: 13,
      rotation: -Math.PI / 2, // 90 degrees in radians (East at top)
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

      const statusClass =
        status.toLowerCase() === "open" ? "trail-open" : "trail-closed";
      const gradeClass = getGradeClass(grade);

      content.innerHTML = `
        <h3>${name}</h3>
        <p>Status: <span class="${statusClass}">${status}</span></p>
        <p>Grade: <span class="${gradeClass}">Grade ${grade}</span></p>
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
