import Papa from "papaparse";
import { Feature } from "ol";
import { LineString } from "ol/geom";
import { fromLonLat } from "ol/proj";
import { trailsSource } from "./map";
import { normalizeData } from "./utils";

// Track loading progress
let pendingRequests = 0;

/**
 * Load trails from CSV file
 * @param {Map} map - OpenLayers Map instance
 */
export function loadTrailsFromCSV(map) {
  Papa.parse("/trails.csv", {
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
          // Check for osmId in both original and lowercase form
          return trail.osmid || trail.osmId || trail["osmid"];
        });

        console.log("Valid trails:", validTrails);

        // Display trails
        validTrails.forEach((trail) => {
          // Use either osmId or osmid, whichever exists
          const id = trail.osmid || trail.osmId || trail["osmid"];
          displayOsmTrail(
            id,
            {
              name: trail.name || trail["name"] || "",
              status: trail.status || trail["status"] || "Unknown",
              comments: trail.comments || trail["comments"] || "",
              grade: trail.grade || trail["grade"] || "1", // Default to Grade 1 if not specified
            },
            map
          );
        });

        // If no valid trails were found
        if (validTrails.length === 0) {
          document.getElementById("loading").innerHTML =
            'No valid trail data found. Make sure your CSV file has an "osmId" column. Available columns: ' +
            Object.keys(results.data[0]).join(", ");
        }
      } else {
        document.getElementById("loading").innerHTML =
          "No trail data found in the CSV file.";
      }
    },
    error: function (error) {
      console.error("Error parsing CSV:", error);
      document.getElementById("loading").innerHTML =
        'Error loading CSV file. Make sure "trails.csv" exists in the public folder.';
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

  const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(
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
            padding: [50, 50, 50, 50],
            duration: 1000,
          });
        }
      } else {
        console.warn(`Way ${osmId} not found in OSM data`);
      }
    })
    .catch((error) => console.error(`Error fetching OSM way ${osmId}:`, error))
    .finally(() => {
      // Decrement pending requests counter
      pendingRequests--;

      // Hide loading indicator if all requests are complete
      if (pendingRequests === 0) {
        document.getElementById("loading").style.display = "none";
      }
    });
}
