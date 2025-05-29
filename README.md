# MTB Trail Status

A simple viewer for mountain biking trail maps with difficulty grading, status updates and offline viewing.

## Configuration & Setup

Trails to display are configured in `./public/trails.csv` in the following format:

```csv
name,osmId,status,comments,grade
Horse Track,434871453,Open,Watch out for horses!,2
Yippi Ki Yay,434871466,Closed,Closed for logging until 1970-01-01,4
```

Fields are:

* `name`: user-friendly display name for the trail
* `osmId`: the OpenStreetMap (OSM) way ID for the trail
* `status`: whether the trail is open or closed
* `comments`: comments to display when viewing a specific trail
* `grade`: the trail difficulty (currently uses the [New Zealand Kennett Brothers grading](https://www.doc.govt.nz/parks-and-recreation/things-to-do/mountain-biking/track-grades/))

Run locally with:

```sh
npm run dev
```
