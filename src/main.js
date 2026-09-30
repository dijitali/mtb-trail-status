import "ol/ol.css";
import "./style.css";
import { config } from "./config";
import { loadTrails } from "./data";
import { createMap } from "./map/createMap";
import { createPanel } from "./ui/panel";
import { setupServiceWorker, saveAreaForOffline } from "./offline";

const $ = (selector) => document.querySelector(selector);

function showNotice(message, { error = false, timeout = 6000 } = {}) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.toggle("error", error);
  toast.hidden = false;
  clearTimeout(showNotice.timer);
  if (timeout) showNotice.timer = setTimeout(() => (toast.hidden = true), timeout);
}

function updateConnectivity() {
  $("#connectivity").hidden = navigator.onLine;
}

async function main() {
  document.title = config.title;
  $("#title").textContent = config.title;

  const panelEl = $("#panel");
  const toggle = $("#panel-toggle");
  toggle.addEventListener("click", () => {
    const open = panelEl.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  const panel = createPanel({
    root: panelEl,
    onTrailClick: (osmId) => {
      mapApi.focusTrail(osmId);
      if (window.matchMedia("(max-width: 720px)").matches) {
        panelEl.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    },
    onSaveOffline: async () => {
      const trailsBbox = mapApi.trailsBbox();
      if (!trailsBbox) return;
      try {
        panel.setOfflineStatus("Saving…", true);
        const result = await saveAreaForOffline({ trailsBbox, overview: mapApi.overviewCoverage() }, {
          onProgress: (done, total) => panel.setOfflineStatus(`Saving map tiles… ${done}/${total}`, true),
        });
        panel.setOfflineStatus(
          result.failed ? `Saved with ${result.failed} of ${result.total} tiles missing.` : `Saved ${result.total} tiles. The map now works offline.`
        );
      } catch (error) {
        panel.setOfflineStatus(error.message);
      }
    },
  });

  const mapApi = createMap({
    target: "map",
    onSelect: (feature) => panel.setSelected(feature ? feature.getId() : null),
  });

  window.addEventListener("online", updateConnectivity);
  window.addEventListener("offline", updateConnectivity);
  updateConnectivity();

  setupServiceWorker({ onUpdated: () => showNotice("A new version is available. Reload to update.", { timeout: 0 }) }).then(
    (active) => {
      if (!active) panel.setOfflineUnavailable();
    }
  );

  const loading = $("#loading");
  try {
    const { features, warnings } = await loadTrails();
    mapApi.setTrails({ type: "FeatureCollection", features });
    panel.setTrails(features);
    mapApi.fitToTrails(0); // instant on first load: no zoom-from-space animation, no wasted tile requests
    loading.hidden = true;
    if (!features.length) {
      showNotice("No trails could be loaded. Check trails.csv.", { error: true, timeout: 0 });
    } else if (warnings.length) {
      console.warn("Trail data warnings:\n" + warnings.join("\n"));
      showNotice(warnings[0], { error: true, timeout: 10000 });
    }
  } catch (error) {
    console.error(error);
    loading.hidden = true;
    showNotice(`Couldn't load trail data: ${error.message}`, { error: true, timeout: 0 });
  }
}

main();
