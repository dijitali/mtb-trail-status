import Papa from "papaparse";
import { Feature } from "ol";
import { LineString } from "ol/geom";
import { fromLonLat } from "ol/proj";
import { trailsSource } from "./map";
import { normalizeData } from "./utils";
import { config } from "./config";
import { getWaysByIds } from "./overpass-service.js";

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
    complete: async function (results) {
      console.log("Parsed CSV data:", results.data);

      if (results.data && results.data.length > 0) {
        // Normalize column names to handle case sensitivity
        const normalizedData = normalizeData(results.data);
        console.log("Normalized data:", normalizedData);

        // Create a map of trail info and a list of OSM IDs
        const trailsInfoMap = new Map();
        const osmIds = normalizedData
          .map((trail) => {
            // 'osmid' should be the lowercase key after normalization
            const id = parseInt(trail.osmid, 10);
            if (id && !isNaN(id)) {
              trailsInfoMap.set(id, {
                name: trail.name || config.trailDefaults.name,
                status: trail.status || config.trailDefaults.status,
                comments: trail.comments || config.trailDefaults.comments,
                grade: trail.grade || config.trailDefaults.grade,
              });
              return id;
            }
            return null;
          })
          .filter((id) => id !== null);

        console.log("Valid trail OSM IDs:", osmIds);

        if (osmIds.length > 0) {
          await displayTrails(osmIds, trailsInfoMap, map);
        }

        // If no valid trails were found
        if (osmIds.length === 0 && loadingElement) {
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
 * Fetch and display OSM ways using their IDs in a batch.
 * @param {number[]} osmIds An array of OpenStreetMap way IDs.
 * @param {Map<number, Object>} trailsInfoMap - A map from OSM way ID to trail information.
 * @param {import("ol/Map").default} map - OpenLayers Map instance
 */
async function displayTrails(osmIds, trailsInfoMap, map) {
  const loadingElement = document.getElementById(
    config.uiMessages.loadingElementId
  );
  try {
    const elements = await getWaysByIds(osmIds);

    // We only need to process the 'way' elements from the response
    const ways = elements.filter((element) => element.type === "way");

    if (ways.length === 0) {
      console.warn(config.uiMessages.wayNotFound(osmIds.join(", ")));
      if (loadingElement) {
        loadingElement.innerHTML = config.uiMessages.wayNotFound(
          osmIds.join(", ")
        );
      }
      return;
    }

    ways.forEach((way) => {
      const trailInfo = trailsInfoMap.get(way.id);
      // The 'geometry' property is added by 'out geom;'
      if (way.geometry && trailInfo) {
        // The geometry is an array of {lat, lon} objects
        const coordinates = way.geometry.map((node) => {
          return fromLonLat([node.lon, node.lat]);
        });

        if (coordinates.length < 2) {
          console.warn(
            `Way ${way.id} has fewer than 2 nodes with coordinates, skipping.`
          );
          return;
        }

        const geometry = new LineString(coordinates);

        const feature = new Feature({
          geometry: geometry,
          name: trailInfo.name,
          status: trailInfo.status,
          grade: trailInfo.grade,
          comments: trailInfo.comments,
        });

        trailsSource.addFeature(feature);
      } else {
        console.warn(`Could not find trail info or geometry for way ${way.id}`);
      }
    });

    if (trailsSource.getFeatures().length > 0) {
      map.getView().fit(trailsSource.getExtent(), {
        padding: config.mapDefaults.padding,
        duration: config.mapDefaults.duration,
      });
    }
  } catch (error) {
    console.error("Error displaying trails:", error);
    if (loadingElement) {
      loadingElement.innerHTML = config.uiMessages.errorLoadingCsv(
        config.dataFiles.trailsCsv
      ); // Or a more specific error
    }
  } finally {
    if (loadingElement) {
      loadingElement.style.display = "none";
    }
  }
}