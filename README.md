# MTB Trail Status

A simple viewer for mountain biking trail maps with difficulty grading, status updates and offline viewing.

Trails are drawn on an OpenStreetMap base map, coloured by grade. Closed trails keep their grade colour but are drawn faded and dashed, and one-way trails are marked with direction arrows. A side panel lists every trail with its status and any comments, and a **Save map for offline** button stores the map tiles for the trail area on the device.

Clicking a trail opens a popup with its status, grade and comments, plus an elevation profile: length, total climb and descent, the steepest 100 m, and a strip under the chart shading each 50 m section by steepness. One-way trails are profiled in the riding direction. Hovering or tapping the profile shows a marker at that spot on the map.

## Updating trail status

Trails are configured in [`public/trails.csv`](public/trails.csv):

```csv
name,osmId,status,comments,grade
Horse Track,434871453,Open,Watch out for horses!,2
Yippi Ki Yay,434871466,Closed,Closed for logging until 1970-01-01,4
```

| Field      | Meaning |
| ---------- | ------- |
| `name`     | Display name for the trail |
| `osmId`    | The OpenStreetMap way ID for the trail |
| `status`   | `Open` or `Closed` (anything else is shown as-is with a grey badge) |
| `comments` | Free text shown in the trail list and popup |
| `grade`    | Difficulty, using the [New Zealand Kennett Brothers grading](https://www.doc.govt.nz/parks-and-recreation/things-to-do/mountain-biking/track-grades/) |

Changing a status or comment is a one-line edit to the CSV. Header names are matched case-insensitively.

## Adding a trail

1. Add a row to `public/trails.csv` with the trail's OSM way ID.
2. Run `npm run fetch-geometry` to download the way's geometry and elevation profile into `public/trails.geojson`.
3. Commit both files.

The app reads geometry and profiles from `trails.geojson` rather than querying OpenStreetMap or an elevation service on every page load, which keeps it fast, avoids rate limits, and makes offline use possible. If a trail is in the CSV but not the GeoJSON, the app fetches its line live from the OSM API as a fallback and shows a warning; it has no profile until the script is run.

```sh
npm run fetch-geometry                 # fetch anything missing
npm run fetch-geometry -- --all        # re-fetch every trail and profile (picks up OSM edits)
npm run fetch-geometry -- --profiles   # re-fetch every elevation profile only
npm run check-geometry                 # fail if anything is missing (used by CI)
```

Elevations are sampled every 10 m along each trail from an [OpenTopoData](https://www.opentopodata.org) dataset. The public API allows 1 request a second and 1,000 a day, which is plenty for occasional updates.

Geometry data is © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright). Elevation data for New Zealand is the LINZ 8 m Digital Elevation Model, [CC BY 4.0](https://data.linz.govt.nz/layer/51768-nz-8m-digital-elevation-model-2012/).

## Configuration

App settings live in [`config.json`](config.json):

- `title`: page and header title
- `map.tileUrl`: base map tile template (defaults to OpenStreetMap; any XYZ tile server works)
- `map.rotation`: view rotation in degrees (the default matches the club's printed map)
- `map.padding`: margin, in pixels, around the trails when the view is fitted to them
- `grades`: name and colour for each grade
- `elevation.dataset`: OpenTopoData dataset for profiles. `nzdem8m` covers New Zealand; use `srtm30m` or another [dataset](https://www.opentopodata.org/#public-api) elsewhere. Remove the `elevation` block to turn profiles off.
- `offline.minZoom` / `offline.maxZoom` / `offline.maxTiles`: zoom range and tile budget for "Save map for offline"

## Offline viewing

The site is a Progressive Web App. A service worker precaches the app itself and keeps copies of `trails.csv`, `trails.geojson` and any map tiles that have been viewed. Trail data is fetched network-first, so a status change appears as soon as the device is online. Pressing **Save map for offline** prefetches every tile covering the trail area between the configured zoom levels, so the whole map is available before the rider loses signal.

## Development

```sh
npm install
npm run dev        # local dev server
npm test           # unit tests (vitest)
npm run build      # production build in dist/
npm run preview    # serve the production build
```

Hosting under a sub-path (for example GitHub Pages at `/mtb-trail-status/`) needs `BASE_PATH=/mtb-trail-status/ npm run build`.

### Project layout

```
config.json              app configuration (bundled at build time)
public/trails.csv        trail list and status, edited by the club
public/trails.geojson    cached trail geometry from OpenStreetMap
scripts/fetch-geometry.mjs  refreshes trails.geojson
src/lib/                 pure data code (CSV, OSM, elevation, profile maths, tiles, arrows, colour) with unit tests in test/
src/map/                 OpenLayers map, styling and popup
src/ui/                  side panel (trail list, legend, offline controls) and elevation profile chart
src/data.js              loads and joins CSV + geometry
src/offline.js           service worker registration and tile prefetch
```
