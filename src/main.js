import "ol/ol.css";
import "./style.css";
import { initMap } from "./map";
import { loadTrailsFromCSV } from "./trailLoader";
import { config, loadAppConfig } from "./config";

// Main application entry point
async function main() {
  try {
    // Load configuration first
    // Assumes config.json is in the public folder and accessible at /config.json
    await loadAppConfig("/config.json");

    // Now `config` object in config.js is populated and can be used by other modules
    // Set page title from config
    document.title = config.pageTitle;

    // Initialize the map
    const map = initMap();

    // Load trails from CSV
    loadTrailsFromCSV(map);
  } catch (error) {
    console.error("Failed to initialize the application:", error);
    // Display a user-friendly error message on the page
    const body = document.querySelector("body");
    if (body) {
      body.innerHTML = `<div style="padding: 20px; text-align: center; color: red; font-family: sans-serif;">
                            <h1>Application Error</h1>
                            <p>Could not start the application. This might be due to a problem loading essential configuration.</p>
                            <p>Please try refreshing the page. If the problem persists, please contact support.</p>
                          </div>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  main();
});
