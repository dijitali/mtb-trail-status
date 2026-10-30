/**
 * Vite plugin that turns the selected park folder into part of the site:
 *  - `virtual:park-config` exports the validated park configuration (bundled, so
 *    a bad park.json fails the build);
 *  - the park's data files are served in dev and written to `park/` in the build,
 *    where riders' browsers fetch them (and where a club can edit trails.csv in place);
 *  - index.html gets the park's title, description and theme colour.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { loadPark, parkDataFiles } from "./park.mjs";

const VIRTUAL_ID = "virtual:park-config";
const RESOLVED_ID = "\0" + VIRTUAL_ID;
const TYPES = { ".csv": "text/csv; charset=utf-8", ".geojson": "application/geo+json", ".json": "application/json" };

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function parkPlugin(park = loadPark()) {
  // Places are optional: if the park has no places file, tell the app not to request one.
  const hasPois = Boolean(park.config.data.pois) && existsSync(path.join(park.dir, park.config.data.pois));
  const appConfig = { id: park.id, ...park.config, data: { ...park.config.data, pois: hasPois ? park.config.data.pois : null } };
  const files = parkDataFiles(appConfig);
  let base = "/";

  return {
    name: "mtb-park",
    configResolved(resolved) {
      base = resolved.base;
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      return `export default ${JSON.stringify(appConfig)};`;
    },
    transformIndexHtml(html) {
      return html
        .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(park.config.title)}</title>`)
        .replace(/(<meta name="theme-color" content=")[^"]*(")/, `$1${park.config.themeColor}$2`)
        .replace(/(<meta name="description" content=")[^"]*(")/, `$1${escapeHtml(park.config.description)}$2`);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        const prefix = `${base.replace(/\/?$/, "/")}park/`;
        if (!url.pathname.startsWith(prefix)) return next();
        const name = url.pathname.slice(prefix.length);
        if (!files.includes(name)) return next();
        const file = path.join(park.dir, name);
        if (!existsSync(file)) {
          res.statusCode = 404;
          return res.end();
        }
        res.setHeader("Content-Type", TYPES[path.extname(name)] || "application/octet-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.end(readFileSync(file));
      });
    },
    generateBundle() {
      for (const name of files) {
        const file = path.join(park.dir, name);
        if (!existsSync(file)) {
          this.error(`Park "${park.id}" is missing ${name}. Run \`npm run fetch-geometry\` if it is the geometry cache.`);
        }
        this.emitFile({ type: "asset", fileName: `park/${name}`, source: readFileSync(file) });
      }
    },
  };
}
