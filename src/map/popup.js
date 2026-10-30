/**
 * Trail detail popup. Content is built with DOM APIs (never innerHTML from
 * CSV text) so a stray "<" in a comment can't inject markup.
 */
import { Overlay } from "ol";
import { getGrade } from "../config";
import { createProfileChart } from "../ui/profileChart";

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
    const grade = getGrade(feature.get("grade"));
    const status = feature.get("status");
    const profile = feature.get("profile");
    const children = [
      el("h3", { textContent: feature.get("name") }),
      el("p", {}, [
        el("span", { className: `status-badge status-${status}`, textContent: feature.get("statusLabel") }),
        " ",
        el("span", {
          className: "grade-chip",
          style: `--grade-color: ${grade.color}`,
          textContent: feature.get("grade") ? `Grade ${feature.get("grade")} · ${grade.name}` : grade.name,
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
    body.replaceChildren(...children.filter(Boolean));
    overlay.setPosition(coordinate);
  }

  return { show, hide, overlay };
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
