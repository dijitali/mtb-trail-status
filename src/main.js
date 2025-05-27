import "ol/ol.css";
import "./style.css";
import { initMap } from "./map";
import { loadTrailsFromCSV } from "./trailLoader";

// Wait for the DOM to be fully loaded before initializing
document.addEventListener("DOMContentLoaded", () => {
  // Initialize the map
  const map = initMap();

  // Load trails from CSV
  loadTrailsFromCSV(map);
});
