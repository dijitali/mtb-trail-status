/**
 * Builds the OpenLayers map (base tiles, trail lines, trail names, places,
 * profile marker) and the popup, and exposes a small API the rest of the app uses.
 *
 * Layer order, bottom to top:
 *   base tiles → trail lines and arrows → trail names → place markers → profile marker
 * Names, place markers and the profile marker share one declutter group, which
 * OpenLayers draws above every ordinary layer, so names always sit on top of lines.
 */
import { Map, View, Feature } from "ol";
import { OSM, Vector as VectorSource } from "ol/source";
import { Tile as TileLayer, Vector as VectorLayer } from "ol/layer";
import { fromLonLat, toLonLat } from "ol/proj";
import { GeoJSON } from "ol/format";
import { Point } from "ol/geom";
import { extend as extendExtent, createEmpty as emptyExtent, isEmpty as isEmptyExtent } from "ol/extent";
import { Style, Circle as CircleStyle, Fill, Stroke } from "ol/style";
import { defaults as defaultControls, ScaleLine } from "ol/control";
import { config, TILE_URL } from "../config";
import { trailStyle, trailLabelStyle } from "./styles";
import { poiStyle } from "./poiStyles";
import { createPopup } from "./popup";

const geojson = new GeoJSON({ dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" });
const OVERLAY_GROUP = "overlay";

/**
 * @param {{ target: HTMLElement|string, onSelect?: (feature: import("ol/Feature").default|null) => void }} options
 *   onSelect receives the selected trail or place; places have `kind: "poi"`.
 */
export function createMap({ target, onSelect }) {
  const trailsSource = new VectorSource();
  const trailsLayer = new VectorLayer({
    source: trailsSource,
    style: trailStyle,
    updateWhileAnimating: true,
    updateWhileInteracting: true,
  });
  const labelsLayer = new VectorLayer({
    source: trailsSource,
    style: trailLabelStyle,
    declutter: OVERLAY_GROUP,
    updateWhileAnimating: true,
    updateWhileInteracting: true,
  });

  const poiSource = new VectorSource();
  const poiLayer = new VectorLayer({
    source: poiSource,
    style: poiStyle,
    declutter: OVERLAY_GROUP,
    updateWhileAnimating: true,
    updateWhileInteracting: true,
  });

  // Marker that follows the cursor on a trail's elevation profile.
  const profileMarker = new Feature();
  const markerLayer = new VectorLayer({
    source: new VectorSource({ features: [profileMarker] }),
    style: new Style({
      image: new CircleStyle({
        radius: 7,
        fill: new Fill({ color: "#0d366b" }),
        stroke: new Stroke({ color: "#ffffff", width: 3 }),
        declutterMode: "none",
      }),
    }),
    declutter: OVERLAY_GROUP,
    updateWhileAnimating: true,
    updateWhileInteracting: true,
  });

  // Without a configured centre, start zoomed right out so no tiles are wasted
  // before the view is fitted to the trails.
  const view = new View({
    center: fromLonLat(config.map.center || [0, 0]),
    zoom: config.map.center ? config.map.zoom : 0,
    rotation: (config.map.rotation * Math.PI) / 180,
  });

  const map = new Map({
    target,
    layers: [new TileLayer({ source: new OSM({ url: TILE_URL, crossOrigin: null }) }), trailsLayer, labelsLayer, poiLayer, markerLayer],
    view,
    controls: defaultControls({ rotate: true }).extend([new ScaleLine()]),
  });

  const popup = createPopup(map, {
    onProfileHover: (feature, fraction) => {
      profileMarker.setGeometry(fraction == null ? undefined : new Point(feature.getGeometry().getCoordinateAt(fraction)));
    },
  });
  let selected = null;

  /** Fit padding from park.json, halved on narrow screens so phones don't lose too much map. */
  function fitPadding() {
    const width = map.getSize()?.[0] ?? 1000;
    return width < 600 ? config.map.padding.map((p) => Math.round(p / 2)) : config.map.padding;
  }

  function anchorOf(feature) {
    const geometry = feature.getGeometry();
    return geometry.getType() === "Point" ? geometry.getCoordinates() : geometry.getCoordinateAt(0.5);
  }

  function select(feature, coordinate) {
    if (selected && selected !== feature) selected.set("selected", false);
    selected = feature || null;
    if (feature) {
      feature.set("selected", true);
      // Places anchor to their marker; trails to where they were clicked.
      const anchor = feature.get("kind") === "poi" ? anchorOf(feature) : coordinate || anchorOf(feature);
      popup.show(feature, anchor);
    } else {
      popup.hide();
    }
    onSelect?.(selected);
  }

  const clickable = (layer) => layer === poiLayer || layer === trailsLayer;
  function featureAt(pixel) {
    // Places take priority over the trail lines they sit on.
    let found = null;
    map.forEachFeatureAtPixel(
      pixel,
      (feature, layer) => {
        if (layer === poiLayer) {
          found = feature;
          return true;
        }
        found ??= feature;
        return false;
      },
      { layerFilter: clickable, hitTolerance: 6 }
    );
    return found;
  }

  map.on("singleclick", (event) => {
    const feature = featureAt(event.pixel);
    select(feature, feature ? event.coordinate : undefined);
  });

  map.on("pointermove", (event) => {
    if (event.dragging) return;
    const hit = map.hasFeatureAtPixel(event.pixel, { layerFilter: clickable, hitTolerance: 6 });
    map.getTargetElement().style.cursor = hit ? "pointer" : "";
  });

  /** Replace all trail features from GeoJSON (in lon/lat). */
  function setTrails(featureCollection) {
    trailsSource.clear();
    trailsSource.addFeatures(geojson.readFeatures(featureCollection));
  }

  /** Replace all places. */
  function setPois(pois) {
    poiSource.clear();
    poiSource.addFeatures(
      pois.map((poi) => {
        const feature = new Feature({ geometry: new Point(fromLonLat([poi.lon, poi.lat])), ...poi, kind: "poi" });
        feature.setId(poi.id);
        return feature;
      })
    );
  }

  /** Extent covering every trail and place, in map projection. */
  function dataExtent() {
    const extent = emptyExtent();
    if (!trailsSource.isEmpty()) extendExtent(extent, trailsSource.getExtent());
    if (!poiSource.isEmpty()) extendExtent(extent, poiSource.getExtent());
    return isEmptyExtent(extent) ? null : extent;
  }

  function fitToData(duration = 600) {
    const extent = dataExtent();
    if (extent) view.fit(extent, { padding: fitPadding(), duration });
  }

  function focus(feature, maxZoom) {
    if (!feature) return;
    if (selected && selected !== feature) popup.hide();
    // Open the popup once the view has settled, so its auto-pan isn't overridden by the fit animation.
    view.fit(feature.getGeometry().getExtent(), {
      padding: fitPadding(),
      duration: 500,
      maxZoom,
      callback: () => select(feature),
    });
  }

  /** Zoom to a single trail and open its popup. */
  const focusTrail = (osmId) => focus(trailsSource.getFeatureById(osmId), 17);
  /** Zoom to a place and open its popup. */
  const focusPoi = (id) => focus(poiSource.getFeatureById(id), 16);

  /** Bounding box of all trails and places in lon/lat: [west, south, east, north]. */
  function dataBbox() {
    const extent = dataExtent();
    if (!extent) return null;
    return [...toLonLat([extent[0], extent[1]]), ...toLonLat([extent[2], extent[3]])];
  }

  /**
   * The area and zoom the map shows when fitted to all trails and places, in lon/lat.
   * Independent of the current view, so "save for offline" always covers the overview.
   * @returns {{ bbox: [number,number,number,number], zoom: number } | null}
   */
  function overviewCoverage() {
    const size = map.getSize();
    const extent = dataExtent();
    if (!extent || !size) return null;
    const [pt, pr, pb, pl] = fitPadding();
    const innerSize = [size[0] - pl - pr, size[1] - pt - pb];
    const resolution = view.getConstrainedResolution(view.getResolutionForExtent(extent, innerSize));
    // Axis-aligned bounds of the (possibly rotated) viewport at that resolution.
    const rotation = view.getRotation();
    const halfW = ((Math.abs(size[0] * Math.cos(rotation)) + Math.abs(size[1] * Math.sin(rotation))) * resolution) / 2;
    const halfH = ((Math.abs(size[0] * Math.sin(rotation)) + Math.abs(size[1] * Math.cos(rotation))) * resolution) / 2;
    const cx = (extent[0] + extent[2]) / 2;
    const cy = (extent[1] + extent[3]) / 2;
    return {
      bbox: [...toLonLat([cx - halfW, cy - halfH]), ...toLonLat([cx + halfW, cy + halfH])],
      zoom: view.getZoomForResolution(resolution),
    };
  }

  return { map, setTrails, setPois, fitToData, focusTrail, focusPoi, dataBbox, overviewCoverage, clearSelection: () => select(null) };
}
