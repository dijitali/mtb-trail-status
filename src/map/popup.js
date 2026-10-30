/**
 * Trail detail popup. Content is built with DOM APIs (never innerHTML from
 * CSV text) so a stray "<" in a comment can't inject markup.
 */
import { Overlay } from "ol";
import { getGrade } from "../config";
import { createProfileChart } from "../ui/profileChart";
import { POI_TYPES, typeLabelFor } from "../lib/pois";
import { poiIconSrc } from "./poiStyles";

/**
 * @param {import("ol/Map").default} map
 * @param {{ onProfileHover?: (feature: import("ol/Feature").default, fraction: number|null) => void }} [options]
 */
export function createPopup(map, { onProfileHover } = {}) {
  const element = document.createElement("div");
  element.className = "popup";
  element.innerHTML = '<button class="popup-close" type="button" aria-label="Close">×</button><div class="popup-body"></div>';
  const body = element.querySelector(".popup-body");

  const overlay = new Overlay({
    element,
    positioning: "bottom-center",
    offset: [0, -12],
    autoPan: { animation: { duration: 250 } },
  });
  map.addOverlay(overlay);

  let shownFeature = null;
  function hide() {
    if (shownFeature) onProfileHover?.(shownFeature, null);
    shownFeature = null;
    overlay.setPosition(undefined);
  }
  element.querySelector(".popup-close").addEventListener("click", hide);

  /**
   * @param {import("ol/Feature").default} feature
   * @param {number[]} coordinate map coordinate to anchor the popup at
   */
  function show(feature, coordinate) {
    if (shownFeature && shownFeature !== feature) onProfileHover?.(shownFeature, null);
    shownFeature = feature;
    body.replaceChildren(...(feature.get("kind") === "poi" ? poiContent(feature) : trailContent(feature)).filter(Boolean));
    overlay.setPosition(coordinate);
  }

  function trailContent(feature) {
    const grade = getGrade(feature.get("grade"));
    const status = feature.get("status");
    const profile = feature.get("profile");
    return [
      el("h3", { textContent: feature.get("name") }),
      el("p", {}, [
        el("span", { className: `status-badge status-${status}`, textContent: feature.get("statusLabel") }),
        " ",
        el("span", {
          className: "grade-chip",
          style: `--grade-color: ${grade.color}`,
          textContent: grade.display,
        }),
      ]),
      feature.get("comments") ? el("p", { textContent: feature.get("comments") }) : null,
      el("p", {
        className: "muted",
        textContent: [
          feature.get("oneway") ? "One-way: ride in the direction of the arrows." : "Two-way trail.",
          feature.get("surface") ? `Surface: ${feature.get("surface")}.` : "",
        ].join(" ").trim(),
      }),
      profile?.ele?.length > 1
        ? createProfileChart(profile, {
            direction: feature.get("oneway"),
            onHover: (fraction) => onProfileHover?.(feature, fraction),
          })
        : el("p", { className: "muted", textContent: "No elevation profile for this trail yet." }),
    ];
  }

  return { show, hide, overlay };
}

function poiContent(feature) {
  const { name, type, lat, lon, description } = feature.getProperties();
  const coords = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  const link = (href, text) => el("a", { href, textContent: text, target: "_blank", rel: "noopener" });
  return [
    el("h3", { textContent: name }),
    el("p", { className: "poi-type" }, [
      el("img", { src: poiIconSrc(type), alt: "", width: 18, height: 18 }),
      // Always name the type for screen readers; show it only when the place name doesn't already.
      typeLabelFor({ name, type }) ?? el("span", { className: "visually-hidden", textContent: (POI_TYPES[type] || POI_TYPES.other).label }),
    ]),
    description ? el("p", { textContent: description }) : null,
    el("p", { className: "muted poi-coords", textContent: coords }),
    el("p", { className: "poi-links" }, [
      link(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`, "Directions"),
      link(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`, "OpenStreetMap"),
    ]),
  ];
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "style") node.setAttribute("style", value);
    else node[key] = value;
  }
  for (const child of children) {
    if (child == null) continue;
    node.append(child);
  }
  return node;
}
