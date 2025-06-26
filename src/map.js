import { Map, View, Overlay } from "ol";
import { OSM } from "ol/source";
import { Tile as TileLayer, Vector as VectorLayer } from "ol/layer";
import { Vector as VectorSource } from "ol/source";
import { fromLonLat } from "ol/proj";
import { Point } from "ol/geom";
import { Style, Stroke, Text, Fill, Icon } from "ol/style";
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

      const oneway = feature.get("oneway");

      // Get grade details for label color
      const gradeInfo = getGradeDetails(grade);

      // Base style for the trail line
      const lineStyle = new Style({
        stroke: new Stroke({
          color: gradeInfo.color, // Use grade color
          width: config.trailLineStyles.lineWidth,
        }),
      });

      // Create style for the text label
      const labelStyle = new Style({
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

      const statusLower = status.toLowerCase();
      let styles = [lineStyle, labelStyle];

      if (statusLower === "closed") {
        // For closed trails: dashed yellow/black line
        styles = [
          new Style({
            stroke: new Stroke({
              color: config.trailLineStyles.closedStyle.baseColorForDash,
              width: config.trailLineStyles.lineWidth,
            }),
          }),
          new Style({
            stroke: new Stroke({
              color: config.trailLineStyles.closedStyle.dashColor,
              width: config.trailLineStyles.lineWidth,
              lineDash: config.trailLineStyles.closedStyle.lineDashPattern,
            }),
          }),
          labelStyle,
        ];
      } else if (oneway) {
        const geometry = feature.getGeometry();
        const length = geometry.getLength();
        const numArrows = Math.min(10, Math.floor(length / 50)); // Adjust 50 to control arrow density

        for (let i = 1; i <= numArrows; i++) {
          const fraction = i / (numArrows + 1);
          const point = geometry.getCoordinateAt(fraction);

          // To determine rotation, get a point slightly further along the line
          const nextPointFraction = Math.min(fraction + 0.001, 1);
          const nextPoint = geometry.getCoordinateAt(nextPointFraction);

          const dx = nextPoint[0] - point[0];
          const dy = nextPoint[1] - point[1];
          const rotation = Math.atan2(dy, dx);

          const arrowStyle = new Style({
            geometry: new Point(point),
            image: new Icon({
              src: 'data:image/svg+xml;utf8,<svg width="24" height="24" viewBox="0 0 24 24" fill="gray" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 22h20L12 2z"/></svg>',
              anchor: [0.5, 0.5],
              rotateWithView: true,
              rotation: -rotation,
              scale: 0.5,
              opacity: 0.8,
            }),
          });
          styles.push(arrowStyle);
        }
      }

      return styles;
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
