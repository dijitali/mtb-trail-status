/**
 * Builds the OpenLayers map with the base layer, trail layer and popup, and
 * exposes a small API the rest of the app uses.
 */
import { Map, View } from "ol";
import { OSM, Vector as VectorSource } from "ol/source";
import { Tile as TileLayer, Vector as VectorLayer } from "ol/layer";
import { fromLonLat, toLonLat } from "ol/proj";
import { GeoJSON } from "ol/format";
import { Feature } from "ol";
import { Point } from "ol/geom";
import { Style, Circle as CircleStyle, Fill, Stroke } from "ol/style";
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

  // Without a configured centre, start zoomed right out so no tiles are wasted
  // before the view is fitted to the trails.
  const view = new View({
    center: fromLonLat(config.map.center || [0, 0]),
    zoom: config.map.center ? config.map.zoom : 0,
    rotation: (config.map.rotation * Math.PI) / 180,
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
      }),
    }),
    updateWhileAnimating: true,
    updateWhileInteracting: true,
  });

  const map = new Map({
    target,
    layers: [new TileLayer({ source: new OSM({ url: TILE_URL, crossOrigin: null }) }), trailsLayer, markerLayer],
    view,
    controls: defaultControls({ rotate: true }).extend([new ScaleLine()]),
  });

  const popup = createPopup(map, {
    onProfileHover: (feature, fraction) => {
      profileMarker.setGeometry(fraction == null ? undefined : new Point(feature.getGeometry().getCoordinateAt(fraction)));
    },
  });
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
    if (selected && selected !== feature) popup.hide();
    // Open the popup once the view has settled, so its auto-pan isn't overridden by the fit animation.
    view.fit(feature.getGeometry().getExtent(), {
      padding: config.map.padding,
      duration: 500,
      maxZoom: 17,
      callback: () => select(feature),
    });
  }

  /** Bounding box of all trails in lon/lat: [west, south, east, north]. */
  function trailsBbox() {
    if (trailsSource.isEmpty()) return null;
    const [minX, minY, maxX, maxY] = trailsSource.getExtent();
    return [...toLonLat([minX, minY]), ...toLonLat([maxX, maxY])];
  }

  /**
   * The area and zoom the map shows when fitted to all trails, in lon/lat.
   * Independent of the current view, so "save for offline" always covers the overview.
   * @returns {{ bbox: [number,number,number,number], zoom: number } | null}
   */
  function overviewCoverage() {
    const size = map.getSize();
    if (trailsSource.isEmpty() || !size) return null;
    const extent = trailsSource.getExtent();
    const [pt, pr, pb, pl] = config.map.padding;
    const innerSize = [size[0] - pl - pr, size[1] - pt - pb];
    const resolution = view.getConstrainedResolution(view.getResolutionForExtent(extent, innerSize));
    // Axis-aligned bounds of the (possibly rotated) viewport at that resolution.
    const rotation = view.getRotation();
    const halfW = (Math.abs(size[0] * Math.cos(rotation)) + Math.abs(size[1] * Math.sin(rotation))) * resolution / 2;
    const halfH = (Math.abs(size[0] * Math.sin(rotation)) + Math.abs(size[1] * Math.cos(rotation))) * resolution / 2;
    const cx = (extent[0] + extent[2]) / 2;
    const cy = (extent[1] + extent[3]) / 2;
    return {
      bbox: [...toLonLat([cx - halfW, cy - halfH]), ...toLonLat([cx + halfW, cy + halfH])],
      zoom: view.getZoomForResolution(resolution),
    };
  }

  return { map, trailsSource, setTrails, fitToTrails, focusTrail, trailsBbox, overviewCoverage, clearSelection: () => select(null) };
}
