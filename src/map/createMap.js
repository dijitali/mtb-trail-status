/**
 * Builds the OpenLayers map with the base layer, trail layer and popup, and
 * exposes a small API the rest of the app uses.
 */
import { Map, View } from "ol";
import { OSM, Vector as VectorSource } from "ol/source";
import { Tile as TileLayer, Vector as VectorLayer } from "ol/layer";
import { fromLonLat, toLonLat } from "ol/proj";
import { GeoJSON } from "ol/format";
import { defaults as defaultControls, ScaleLine } from "ol/control";
import { config, TILE_URL } from "../config";
import { trailStyle } from "./styles";
import { createPopup } from "./popup";

const geojson = new GeoJSON({ dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" });

/**
 * @param {{ target: HTMLElement|string, onSelect?: (feature: import("ol/Feature").default|null) => void }} options
 */
export function createMap({ target, onSelect }) {
  const trailsSource = new VectorSource();
  const trailsLayer = new VectorLayer({
    source: trailsSource,
    style: trailStyle,
    declutter: true,
    updateWhileAnimating: true,
    updateWhileInteracting: true,
  });

  const view = new View({
    center: fromLonLat(config.map.center || [0, 0]),
    zoom: config.map.zoom,
    rotation: (config.map.rotation * Math.PI) / 180,
  });

  const map = new Map({
    target,
    layers: [new TileLayer({ source: new OSM({ url: TILE_URL, crossOrigin: null }) }), trailsLayer],
    view,
    controls: defaultControls({ rotate: true }).extend([new ScaleLine()]),
  });

  const popup = createPopup(map);
  let selected = null;

  function select(feature, coordinate) {
    if (selected && selected !== feature) selected.set("selected", false);
    selected = feature || null;
    if (feature) {
      feature.set("selected", true);
      popup.show(feature, coordinate || feature.getGeometry().getCoordinateAt(0.5));
    } else {
      popup.hide();
    }
    onSelect?.(selected);
  }

  map.on("singleclick", (event) => {
    const feature = map.forEachFeatureAtPixel(event.pixel, (f) => f, { layerFilter: (l) => l === trailsLayer, hitTolerance: 6 });
    select(feature, feature ? event.coordinate : undefined);
  });

  map.on("pointermove", (event) => {
    if (event.dragging) return;
    const hit = map.hasFeatureAtPixel(event.pixel, { layerFilter: (l) => l === trailsLayer, hitTolerance: 6 });
    map.getTargetElement().style.cursor = hit ? "pointer" : "";
  });

  /** Replace all trail features from GeoJSON (in lon/lat). */
  function setTrails(featureCollection) {
    trailsSource.clear();
    trailsSource.addFeatures(geojson.readFeatures(featureCollection));
  }

  function fitToTrails(duration = 600) {
    if (trailsSource.isEmpty()) return;
    view.fit(trailsSource.getExtent(), { padding: config.map.padding, duration });
  }

  /** Zoom to a single trail and open its popup. */
  function focusTrail(osmId) {
    const feature = trailsSource.getFeatureById(osmId);
    if (!feature) return;
    view.fit(feature.getGeometry().getExtent(), { padding: config.map.padding, duration: 500, maxZoom: 17 });
    select(feature);
  }

  /** Bounding box of all trails in lon/lat: [west, south, east, north]. */
  function trailsBbox() {
    if (trailsSource.isEmpty()) return null;
    const [minX, minY, maxX, maxY] = trailsSource.getExtent();
    return [...toLonLat([minX, minY]), ...toLonLat([maxX, maxY])];
  }

  return { map, trailsSource, setTrails, fitToTrails, focusTrail, trailsBbox, clearSelection: () => select(null) };
}
