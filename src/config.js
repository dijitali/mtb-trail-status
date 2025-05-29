// This will be populated after fetching config.json
export let config = {};

// Helper function to get grade details (color, class name, display name)
// This relies on `config` being populated.
export function getGradeDetails(gradeValue) {
  if (!config.gradingSystem) {
    console.error("Config not loaded yet or gradingSystem is missing.");
    // Return a very basic default to prevent crashes, but this indicates a problem.
    return { name: "Loading...", color: "#888888", className: "grade-loading" };
  }
  const gradeString = String(gradeValue); // Ensure gradeValue is a string for object key lookup
  return config.gradingSystem[gradeString] || config.gradingSystem.default;
}

// Function to load and process the configuration
export async function loadAppConfig(configPath = "/config.json") {
  try {
    const response = await fetch(configPath);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch config: ${response.status} ${response.statusText}`
      );
    }
    const loadedConfig = await response.json();

    // Merge the loaded config into the exported `config` object
    Object.assign(config, loadedConfig);

    // Add/Override any parts of the config that require functions or dynamic setup
    if (!config.uiMessages) {
      config.uiMessages = {};
    }
    config.uiMessages.noValidTrails = (csvColumns) =>
      `No valid trail data found. Ensure your CSV has an "osmid" column (case-insensitive). Available columns: ${csvColumns.join(
        ", "
      )}`;
    config.uiMessages.errorLoadingCsv = (fileName) =>
      `Error loading CSV file. Make sure "${fileName}" exists in the public folder.`;
    config.uiMessages.wayNotFound = (osmId) =>
      `Way ${osmId} not found in OSM data.`;
    config.uiMessages.errorFetchingWay = (osmId, error) =>
      `Error fetching OSM way ${osmId}: ${error}`;

    console.log("Configuration loaded and processed:", config);
    return config;
  } catch (error) {
    console.error("Error loading application configuration:", error);
    // Fallback to a minimal default config to prevent the app from completely breaking
    Object.assign(config, {
      pageTitle: "Error Loading Config",
      mapDefaults: {
        zoom: 10,
        center: [0, 0],
        rotation: 0,
        padding: [10, 10, 10, 10],
        duration: 0,
      },
      gradingSystem: {
        default: { name: "Error", color: "#ff0000", className: "grade-error" },
      },
      apiUrls: {},
      dataFiles: { trailsCsv: "/trails.csv" }, // Keep a default for trailsCsv for errorLoadingCsv message
      trailDefaults: { name: "N/A", status: "Error", grade: "0" },
      trailLineStyles: { lineWidth: 1, statusColors: { unknown: "black" } },
      trailLabelStyles: {
        font: "10px Arial",
        strokeColor: "red",
        strokeWidth: 1,
      },
      uiMessages: {
        loadingElementId: "loading",
        initialLoading: "Error: Could not load app configuration.",
        noValidTrails: () => "Error loading config.",
        noDataInCsv: "Error loading config.",
        errorLoadingCsv: (fileName) =>
          `Error loading CSV file. Make sure "${fileName}" exists. Config load failed.`,
        wayNotFound: () => "Error loading config.",
        errorFetchingWay: () => "Error loading config.",
      },
      popup: { statusClasses: { unknown: "error" } },
    });
    const loadingEl = document.getElementById(
      config.uiMessages.loadingElementId || "loading"
    );
    if (loadingEl) {
      loadingEl.innerHTML =
        "Critical Error: Application configuration could not be loaded. Please try again later or contact support.";
      loadingEl.style.display = "block";
      loadingEl.style.color = "red";
    }
    throw error; // Re-throw to signal failure to the caller in main.js
  }
}
