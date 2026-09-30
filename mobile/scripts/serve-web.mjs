// SERVE THE EXPORTED WEB BUILD, SO SEEING A SCREEN COSTS NOTHING.
//
// Ruth, 30 September 2026: "surely we need to fix the fact that you can't see
// the screens. I can't work this slowly."
//
// She is right, and the thing standing in the way was never the app. The Expo
// WEB DEV SERVER cannot run on this machine: it re-bundles the whole of
// expo-router on every request and holds it in memory, and it has died of that
// four times now - 22, 24 and twice on 30 September - at exit 134, without ever
// answering on 8081. start-web.mjs carries the full account. The consequence
// was that no screen could be looked at before Ruth looked at it, so every UI
// mistake cost a round trip through her: the onboarding screen with no Continue
// button on it went six days unnoticed for exactly this reason.
//
// A STATIC EXPORT IS A DIFFERENT SHAPE OF WORK. `expo export --platform web`
// bundles once, as a batch job, and writes plain files. Nothing re-bundles,
// nothing is held open, and serving the result costs a few megabytes rather
// than six gigabytes. It is the same app: app.json has had `web.output:
// "static"` all along.
//
// WHAT IS LOST, said plainly rather than discovered later: there is no Fast
// Refresh. A code change needs another export before it shows here. That is a
// two-minute batch job against a dev server that cannot start at all.
//
// NO NEW DEPENDENCY. `npx serve` would do this and is not installed; the built
// -in http module is forty lines.
//
//   node scripts/serve-web.mjs [port]
//
// Expo's static output writes one .html per route - /onboarding/skill.html for
// /onboarding/skill - so a path is tried as itself, then as .html, then as
// index.html inside it, and only then falls back to the root document.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', 'dist-web');
const PORT = Number(process.argv[2] ?? 8081);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

if (!fs.existsSync(ROOT)) {
  console.error(
    `\n  No build at ${ROOT}.\n\n` +
      '  Build it first (a few minutes, and it needs the heap):\n' +
      '    cd mobile\n' +
      '    NODE_OPTIONS=--max-old-space-size=10240 npx expo export --platform web --output-dir dist-web\n'
  );
  process.exit(1);
}

/** The first of these that exists on disk, or null. */
function resolve(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  const candidates = clean
    ? [clean, `${clean}.html`, path.join(clean, 'index.html')]
    : ['index.html'];
  for (const c of candidates) {
    // Never serve outside the build: a path that climbs out is not a route.
    const full = path.resolve(ROOT, c);
    if (!full.startsWith(path.resolve(ROOT))) continue;
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  return null;
}

http
  .createServer((req, res) => {
    // A ROUTE THAT DOES NOT EXIST MUST NOT LOOK LIKE THE HOME SCREEN, which is
    // the exact trap the dead dev server set on 24 September: every failed
    // request came back as a page whose pathname was "/", and a screenshot run
    // reported three routes as having redirected to the home screen. That read
    // as a routing bug in the app and cost half an hour. So a miss is a 404
    // with the path in it, and says so out loud.
    const found = resolve(req.url ?? '/');
    if (!found) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`No file in the export for ${req.url}\n`);
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(found).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    fs.createReadStream(found).pipe(res);
  })
  .listen(PORT, () => {
    console.log(`  Serving ${path.relative(process.cwd(), ROOT)} on http://localhost:${PORT}`);
  });
