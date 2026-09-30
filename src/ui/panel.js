/**
 * Side panel: trail list with status/grade, legend, and offline controls.
 * Plain DOM, no framework.
 */
import { getGrade, listGrades } from "../config";

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

/**
 * @param {{
 *   root: HTMLElement,
 *   onTrailClick: (osmId: number) => void,
 *   onSaveOffline: () => void,
 * }} options
 */
export function createPanel({ root, onTrailClick, onSaveOffline }) {
  const summary = el("p", { className: "summary", textContent: "Loading trails…" });
  const list = el("ul", { className: "trail-list" });
  const offlineButton = el("button", { type: "button", className: "btn", textContent: "Save map for offline" });
  const offlineStatus = el("p", { className: "muted offline-status" });
  offlineButton.addEventListener("click", onSaveOffline);

  const legend = el("section", { className: "legend" }, [
    el("h2", { textContent: "Legend" }),
    el(
      "ul",
      {},
      [
        ...listGrades().map(({ grade, name, color }) =>
          el("li", {}, [el("span", { className: "swatch", style: `background:${color}` }), `Grade ${grade} · ${name}`])
        ),
        el("li", {}, [el("span", { className: "swatch swatch-closed" }), "Closed trail"]),
        el("li", {}, [el("span", { className: "swatch swatch-arrow", textContent: "›" }), "One-way direction"]),
      ]
    ),
  ]);

  root.replaceChildren(
    el("section", { className: "panel-section" }, [summary, list]),
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
        const item = el("li", { className: `trail trail-${p.status}`, dataset: { osmId: String(p.osmId) } }, [
          el("button", { type: "button", className: "trail-button" }, [
            el("span", { className: "grade-dot", style: `background:${grade.color}`, title: grade.name }),
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

  function setSelected(osmId) {
    for (const item of list.children) {
      item.classList.toggle("selected", item.dataset.osmId === String(osmId));
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

  return { setTrails, setSelected, setOfflineStatus, setOfflineUnavailable };
}
