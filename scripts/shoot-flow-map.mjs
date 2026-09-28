// EVERY SCREEN IN SELODÍA, SHOT FROM THE CURRENT BUILD.
//
// The picture half of the flow map. The poster is composed by
// scripts/flow_map_poster.py from what this writes.
//
// THE ROUTE LIST IS DERIVED, NOT TYPED. This is the change that matters on
// 28 September 2026. The previous version carried a hand-written list, and by
// the time Ruth asked for a retake it was asking for `/log/entries?view=food`,
// which no longer exists, while never having heard of `/log/measurements`,
// `/settings/feedback`, `/settings/beta-feedback`, `/settings/tracking` or
// `/onboarding/reset-password`. A map built from a stale list is worse than no
// map: it is confidently wrong about what the app contains.
//
// Now it walks `mobile/src/app` the way expo-router does - route groups in
// parentheses contribute nothing to the URL, `index` is its directory, `_layout`
// is machinery - so a screen added tomorrow is in tomorrow's map with nobody
// remembering anything.
//
// NOTHING IS WRITTEN TO THE DATABASE. Every route here is a read. Onboarding
// screens are opened and photographed, never completed.
//
// SHOT FROM THE DEMO ACCOUNT, which is Ruth's own. The map is private and stays
// private; see the notes document filed beside it.
//
//   npm --prefix mobile run web        (or preview_start "expo-mobile-web")
//   node scripts/shoot-flow-map.mjs

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = 'C:\\Users\\ruthi\\unflump-app';
const APP = path.join(ROOT, 'mobile', 'src', 'app');
const OUT = path.join(ROOT, 'scripts', 'flow-map-shots');
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:8081';
const DEMO = 'unflumpapp@gmail.com';

// A dynamic segment cannot be photographed without a value. These are the app's
// own, and the values are the ones a person actually reaches.
const FILL = {
  '[dimension]': ['strength', 'cardio', 'flexibility', 'balance', 'bone', 'recovery'],
};

function discover(dir = APP, parts = []) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // A name wrapped in parentheses is a route GROUP: it organises files and
      // contributes nothing to the URL.
      const segment = /^\(.+\)$/.test(entry.name) ? null : entry.name;
      out.push(...discover(full, segment ? [...parts, segment] : parts));
      continue;
    }
    if (!entry.name.endsWith('.tsx') || entry.name === '_layout.tsx') continue;
    const base = entry.name.slice(0, -'.tsx'.length);
    const segments = base === 'index' ? parts : [...parts, base];
    const url = '/' + segments.join('/');

    const dynamic = url.match(/\[[^\]]+\]/);
    if (dynamic) {
      for (const value of FILL[dynamic[0]] ?? []) out.push(url.replace(dynamic[0], value));
    } else {
      out.push(url);
    }
  }
  return out;
}

const ROUTES = [...new Set(discover())].sort((a, b) => a.localeCompare(b));
const label = (url) => url.replace(/^\//, '').replace(/\//g, '-') || 'chat';
// Chat and Today do the most work on arrival, so they get longer to settle.
const settle = (url) => (url === '/' || url === '/today' ? 6000 : 4000);

console.log(`${ROUTES.length} screens discovered from the router tree\n`);

const E = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

async function session() {
  const link = await fetch(`${E.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: E.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${E.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'magiclink', email: DEMO }),
  }).then((r) => r.json());
  const hashed = link?.properties?.hashed_token ?? link?.hashed_token;
  return fetch(`${E.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: E.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: hashed }),
  }).then((r) => r.json());
}

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));

const auth = await session();
if (!auth?.access_token) {
  console.error('No session for the demo account. Nothing shot.');
  process.exitCode = 1;
} else {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    args: ['--hide-scrollbars'],
    // THE EXPO DEV SERVER BUNDLES ON FIRST REQUEST, and the first one takes
    // minutes. puppeteer's own protocol timeout is three minutes and is NOT the
    // navigation timeout - it fires underneath it, so a generous `goto` timeout
    // alone does nothing. That is what killed the first run of this.
    protocolTimeout: 900_000,
  });

  const page = await browser.newPage();

  // THE SESSION GOES IN BEFORE THE FIRST NAVIGATION. The auth guard redirects to
  // onboarding before supabase-js can read tokens out of a URL fragment, so a
  // link-based sign-in never survives the first render.
  const ref = new URL(E.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 600000 });
  await page.evaluate(
    (key, value) => window.localStorage.setItem(key, value),
    `sb-${ref}-auth-token`,
    JSON.stringify({
      access_token: auth.access_token,
      refresh_token: auth.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: auth.user,
    })
  );

  const done = [];
  const failed = [];
  for (const url of ROUTES) {
    const name = label(url);
    try {
      await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 600000 });
      await new Promise((r) => setTimeout(r, settle(url)));
      const file = path.join(OUT, `${name}.png`);
      await page.screenshot({ path: file });
      done.push(name);
      console.log(`  ${String(done.length).padStart(2)}/${ROUTES.length}  ${name}`);
    } catch (err) {
      failed.push([name, err instanceof Error ? err.message : String(err)]);
      console.log(`  --      ${name}  FAILED: ${err instanceof Error ? err.message : err}`);
    }
  }

  await browser.close();

  fs.writeFileSync(
    path.join(OUT, 'manifest.json'),
    JSON.stringify({ shotAt: new Date().toISOString(), routes: ROUTES, done, failed }, null, 2)
  );

  console.log(`\n  ${done.length} shot, ${failed.length} failed, into ${OUT}`);
  // A MAP MISSING SCREENS IS THE FAILURE THIS WHOLE EXERCISE IS FIXING, so a
  // failure is loud and the exit code says so.
  if (failed.length > 0) process.exitCode = 1;
}
