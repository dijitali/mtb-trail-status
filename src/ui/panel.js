/**
 * Side panel: trail list with status/grade, places, legend, and offline controls.
 * Plain DOM, no framework.
 */
import { getGrade, listGrades } from "../config";
import { muted } from "../lib/color";
import { POI_TYPES, typeLabelFor } from "../lib/pois";
import { poiIconSrc } from "../map/poiStyles";

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "style") node.setAttribute("style", value);
    else if (key === "dataset") Object.assign(node.dataset, value);
    else node[key] = value;
  }
  for (const child of children) if (child != null) node.append(child);
  return node;
}

const poiIcon = (type, size = 18) => el("img", { className: "poi-icon", src: poiIconSrc(type), alt: "", width: size, height: size });

/**
 * @param {{
 *   root: HTMLElement,
 *   onTrailClick: (osmId: number) => void,
 *   onPoiClick: (id: string) => void,
 *   onSaveOffline: () => void,
 * }} options
 */
export function createPanel({ root, onTrailClick, onPoiClick, onSaveOffline }) {
  const summary = el("p", { className: "summary", textContent: "Loading trails…" });
  const list = el("ul", { className: "trail-list" });
  const placesList = el("ul", { className: "trail-list places-list" });
  const places = el("section", { className: "panel-section places", hidden: true }, [el("h2", { textContent: "Places" }), placesList]);
  const offlineButton = el("button", { type: "button", className: "btn", textContent: "Save map for offline" });
  const offlineStatus = el("p", { className: "muted offline-status" });
  offlineButton.addEventListener("click", onSaveOffline);

  const grades = listGrades();
  const example = grades[Math.min(1, grades.length - 1)];
  const legendPlaces = el("ul", { className: "legend-places" });
  const legend = el("section", { className: "legend" }, [
    el("h2", { textContent: "Legend" }),
    el("ul", {}, [
      ...grades.map(({ display, color }) => el("li", {}, [el("span", { className: "swatch", style: `background:${color}` }), display])),
      el("li", {}, [
        el("span", { className: "swatch swatch-closed", style: `--closed-color:${muted(example.color)}` }),
        "Closed: grade colour, faded and dashed",
      ]),
      el("li", {}, [el("span", { className: "swatch swatch-arrow", textContent: "›" }), "One-way direction"]),
    ]),
    legendPlaces,
  ]);

  root.replaceChildren(
    el("section", { className: "panel-section" }, [summary, list]),
    places,
    legend,
    el("section", { className: "panel-section offline" }, [
      el("h2", { textContent: "Offline" }),
      el("p", { className: "muted", textContent: "Store the map tiles around the trails on this device so the map works without signal." }),
      offlineButton,
      offlineStatus,
    ])
  );

  /** @param {object[]} features GeoJSON features with trail properties */
  function setTrails(features) {
    const sorted = [...features].sort((a, b) => a.properties.name.localeCompare(b.properties.name));
    const closed = sorted.filter((f) => f.properties.status === "closed").length;
    const open = sorted.filter((f) => f.properties.status === "open").length;
    summary.textContent = `${sorted.length} trails · ${open} open · ${closed} closed`;

    list.replaceChildren(
      ...sorted.map(({ properties: p }) => {
        const grade = getGrade(p.grade);
        const item = el("li", { className: `trail trail-${p.status}`, dataset: { key: `trail:${p.osmId}` } }, [
          el("button", { type: "button", className: "trail-button" }, [
            el("span", {
              className: "grade-dot",
              style: `background:${p.status === "closed" ? muted(grade.color) : grade.color}`,
              title: grade.display,
            }),
            el("span", { className: "trail-name", textContent: p.name }),
            el("span", { className: `status-badge status-${p.status}`, textContent: p.statusLabel }),
          ]),
          p.comments ? el("p", { className: "trail-comments", textContent: p.comments }) : null,
        ]);
        item.querySelector("button").addEventListener("click", () => onTrailClick(p.osmId));
        return item;
      })
    );
  }

  /** @param {import("../lib/pois").Poi[]} pois */
  function setPois(pois) {
    places.hidden = pois.length === 0;
    // Entrances first, then by type order, then name.
    const order = Object.keys(POI_TYPES);
    const sorted = [...pois].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || a.name.localeCompare(b.name));
    placesList.replaceChildren(
      ...sorted.map((poi) => {
        const item = el("li", { className: "trail", dataset: { key: `poi:${poi.id}` } }, [
          el("button", { type: "button", className: "trail-button" }, [
            poiIcon(poi.type),
            el("span", { className: "trail-name", textContent: poi.name }),
            typeLabelFor(poi) ? el("span", { className: "muted place-type", textContent: typeLabelFor(poi) }) : null,
          ]),
        ]);
        item.querySelector("button").addEventListener("click", () => onPoiClick(poi.id));
        return item;
      })
    );
    const types = order.filter((type) => pois.some((p) => p.type === type));
    legendPlaces.replaceChildren(...types.map((type) => el("li", {}, [poiIcon(type, 16), POI_TYPES[type].label])));
  }

  /** @param {string|null} key "trail:<osmId>" or "poi:<id>" */
  function setSelected(key) {
    for (const item of root.querySelectorAll("li[data-key]")) {
      item.classList.toggle("selected", item.dataset.key === key);
    }
  }

  function setOfflineStatus(text, busy = false) {
    offlineStatus.textContent = text;
    offlineButton.disabled = busy;
  }

  /** Called when the service worker can't be installed (unsupported browser, private mode, sandboxed embed). */
  function setOfflineUnavailable() {
    offlineButton.disabled = true;
    offlineStatus.textContent = "Offline storage isn't available in this browser.";
  }

  return { setTrails, setPois, setSelected, setOfflineStatus, setOfflineUnavailable };
}
