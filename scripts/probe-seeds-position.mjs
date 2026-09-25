// Where does the three-seeds "More" mark actually sit, on every screen?
//
//   node audit-seeds.mjs
//
// Ruth, 25 September 2026: it "must sit at the same fixed vertical position on
// every screen, flush top right, not relative to the page heading". That is a
// claim about pixels on eleven screens, so it is measured rather than reasoned
// about - the same mistake as the sentence under the wheel, which I argued my
// way into twice before checking.
//
// Reports each screen's mark box. Every row should carry the same top and the
// same distance from the right edge.

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = 'C:/Users/ruthi/unflump-app';
const E = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#'))
    E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const SUPA = E.NEXT_PUBLIC_SUPABASE_URL || E.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE = E.SUPABASE_SERVICE_ROLE_KEY;
const ANON = E.EXPO_PUBLIC_SUPABASE_ANON_KEY || E.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const link = await fetch(`${SUPA}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'magiclink', email: 'unflumpapp+store@gmail.com' }),
}).then((r) => r.json());
const session = await fetch(`${SUPA}/auth/v1/verify`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'magiclink', token_hash: link?.properties?.hashed_token ?? link?.hashed_token }),
}).then((r) => r.json());
if (!session.access_token) {
  console.error('no session for the store account');
  process.exit(1);
}

const ref = new URL(SUPA).hostname.split('.')[0];
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  defaultViewport: { width: 360, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
page.setDefaultTimeout(240000);
await page.evaluateOnNewDocument(
  (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
  `sb-${ref}-auth-token`,
  JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
    expires_in: session.expires_in ?? 3600,
    token_type: 'bearer',
    user: session.user,
  })
);

const SCREENS = [
  ['Chat', '/'],
  ['Log', '/log'],
  ['Today', '/today'],
  ['Plans', '/plans'],
  ['Almanac', '/almanac'],
  ['Food & Drink', '/log/food-history'],
  ['Activity', '/log/activity-history'],
  ['Hydration', '/log/water-history'],
  ['Measurements', '/log/measurements'],
  ['Sleep', '/log/sleep'],
  ['Cycle', '/log/cycle'],
  ['How you felt', '/log/feeling'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];

for (const [name, route] of SCREENS) {
  let ok = true;
  try {
    await page.goto(`http://localhost:8081${route}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  } catch {
    ok = false;
  }
  await sleep(ok ? 9000 : 0);

  const box = ok
    ? await page.evaluate(() => {
        const el = [...document.querySelectorAll('[aria-label="More"]')].find((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          top: Math.round(r.top),
          fromRight: Math.round(window.innerWidth - r.right),
          size: Math.round(r.width),
        };
      })
    : null;

  rows.push({ name, ok, box });
  console.log(
    `  ${name.padEnd(14)} ${
      !ok ? 'DID NOT LOAD' : box ? `top ${String(box.top).padStart(3)}   ${String(box.fromRight).padStart(3)} from the right   ${box.size}px` : 'NO MARK'
    }`
  );
}

const found = rows.filter((r) => r.box).map((r) => r.box);
const tops = [...new Set(found.map((b) => b.top))];
const rights = [...new Set(found.map((b) => b.fromRight))];
console.log(`\n  distinct tops   : ${tops.join(', ') || '-'}`);
console.log(`  distinct rights : ${rights.join(', ') || '-'}`);
const consistent = tops.length === 1 && rights.length === 1;
console.log(consistent ? '\n  ONE POSITION EVERYWHERE\n' : '\n  STILL INCONSISTENT\n');

await browser.close();
process.exit(consistent ? 0 : 1);
