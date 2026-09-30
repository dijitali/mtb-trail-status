# MTB Trail Status

A simple viewer for mountain biking trail maps with difficulty grading, status updates and offline viewing.

Trails are drawn on an OpenStreetMap base map, coloured by grade, with closed trails shown in hazard-tape black and yellow and one-way trails marked with direction arrows. A side panel lists every trail with its status and any comments, and a **Save map for offline** button stores the map tiles for the trail area on the device.

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
2. Run `npm run fetch-geometry` to download the way's geometry into `public/trails.geojson`.
3. Commit both files.

The app reads geometry from `trails.geojson` rather than querying OpenStreetMap on every page load, which keeps it fast, avoids Overpass rate limits, and makes offline use possible. If a trail is in the CSV but not the GeoJSON, the app fetches it live from the OSM API as a fallback and shows a warning. `npm run fetch-geometry -- --all` re-downloads every trail to pick up OSM edits.

Geometry data is © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright).

## Configuration

App settings live in [`config.json`](config.json):

- `title`: page and header title
- `map.tileUrl`: base map tile template (defaults to OpenStreetMap; any XYZ tile server works)
- `map.rotation`: view rotation in degrees (the default matches the club's printed map)
- `map.padding`: margin, in pixels, around the trails when the view is fitted to them
- `grades`: name and colour for each grade
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
src/lib/                 pure data code (CSV, OSM, tile maths, arrow placement) with unit tests in test/
src/map/                 OpenLayers map, styling and popup
src/ui/                  side panel (trail list, legend, offline controls)
src/data.js              loads and joins CSV + geometry
src/offline.js           service worker registration and tile prefetch
```
