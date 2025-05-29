import Papa from "papaparse";
import { Feature } from "ol";
import { LineString } from "ol/geom";
import { fromLonLat } from "ol/proj";
import { trailsSource } from "./map";
import { normalizeData } from "./utils";
import { config } from "./config";

// Track loading progress
let pendingRequests = 0;

/**
 * Load trails from CSV file
 * @param {Map} map - OpenLayers Map instance
 */
export function loadTrailsFromCSV(map) {
  const loadingElement = document.getElementById(
    config.uiMessages.loadingElementId
  );
  if (loadingElement) {
    loadingElement.innerHTML = config.uiMessages.initialLoading;
    loadingElement.style.display = "block"; // Ensure it's visible
  }
  Papa.parse(config.dataFiles.trailsCsv, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      console.log("Parsed CSV data:", results.data);

      if (results.data && results.data.length > 0) {
        // Normalize column names to handle case sensitivity
        const normalizedData = normalizeData(results.data);
        console.log("Normalized data:", normalizedData);

        // Filter out any rows without OSM IDs
        const validTrails = normalizedData.filter((trail) => {
          // 'osmid' should be the lowercase key after normalization
          return trail.osmid;
        });

        console.log("Valid trails:", validTrails);

        // Display trails
        validTrails.forEach((trail) => {
          const id = trail.osmid; // Accessing via lowercase key
          displayOsmTrail(
            id,
            {
              name: trail.name || config.trailDefaults.name,
              status: trail.status || config.trailDefaults.status,
              comments: trail.comments || config.trailDefaults.comments,
              grade: trail.grade || config.trailDefaults.grade,
            },
            map
          );
        });

        // If no valid trails were found
        if (validTrails.length === 0 && loadingElement) {
          const columnNames = results.data[0]
            ? Object.keys(results.data[0])
            : [];
          loadingElement.innerHTML =
            config.uiMessages.noValidTrails(columnNames);
        }
      } else if (loadingElement) {
        loadingElement.innerHTML = config.uiMessages.noDataInCsv;
      }
    },
    error: function (error) {
      console.error("Error parsing CSV:", error);
      if (loadingElement) {
        loadingElement.innerHTML = config.uiMessages.errorLoadingCsv(
          config.dataFiles.trailsCsv
        );
      }
    },
  });
}

/**
 * Fetch and display an OSM way using its ID
 * @param {string|number} osmId - OSM way ID
 * @param {Object} trailInfo - Trail information
 * @param {Map} map - OpenLayers Map instance
 */
function displayOsmTrail(osmId, trailInfo, map) {
  // Increment pending requests counter
  pendingRequests++;

  // Overpass API query to get the way geometry
  const overpassQuery = `
    [out:json];
    way(${osmId});
    (._;>;);
    out body;
  `;

  const overpassUrl = `${config.apiUrls.overpass}?data=${encodeURIComponent(
    overpassQuery
  )}`;

  fetch(overpassUrl)
    .then((response) => response.json())
    .then((data) => {
      // Extract nodes from the response
      const nodes = {};
      data.elements.forEach((element) => {
        if (element.type === "node") {
          nodes[element.id] = [element.lon, element.lat]; // Note: OpenLayers uses [lon, lat] order for fromLonLat
        }
      });

      // Find the way and construct the path
      const way = data.elements.find(
        (element) => element.type === "way" && element.id == osmId
      );
      if (way) {
        // Create coordinates array and transform to web mercator
        const coordinates = way.nodes.map((nodeId) => {
          return fromLonLat(nodes[nodeId]);
        });

        // Create a LineString geometry
        const geometry = new LineString(coordinates);

        // Create a feature with the geometry and properties
        const feature = new Feature({
          geometry: geometry,
          name: trailInfo.name,
          status: trailInfo.status,
          grade: trailInfo.grade,
          comments: trailInfo.comments,
        });

        // Add the feature to the source
        trailsSource.addFeature(feature);

        // Fit the map to include all trails
        if (trailsSource.getFeatures().length === 1) {
          map.getView().fit(trailsSource.getExtent(), {
            padding: config.mapDefaults.padding,
            duration: config.mapDefaults.duration,
          });
        }
      } else {
        console.warn(config.uiMessages.wayNotFound(osmId));
      }
    })
    .catch((error) => {
      console.error(config.uiMessages.errorFetchingWay(osmId, error));
    })
    .finally(() => {
      // Decrement pending requests counter
      pendingRequests--;

      // Hide loading indicator if all requests are complete
      if (pendingRequests === 0) {
        const loadingElement = document.getElementById(
          config.uiMessages.loadingElementId
        );
        if (loadingElement) {
          loadingElement.style.display = "none";
        }
      }
    });
}
