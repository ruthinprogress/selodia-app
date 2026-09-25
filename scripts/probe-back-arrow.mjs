// Can you still get back out of a Log screen?
//
// The Log stack lost its native header today so the More mark could sit at one
// fixed position on every screen. The header was carrying the back arrow, and
// BodyScreen draws its own now - but only when router.canGoBack() says there is
// somewhere to go. Loading a screen DIRECTLY, as the screenshot run does, is
// exactly the case where that is false, so a screenshot of one proves nothing
// about the case that matters.
//
// This walks in from the Log list, the way a thumb does, and checks the arrow
// is there and works.

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A real tap: react-native-web's Pressable ignores element.click(). */
async function tap(needle) {
  const box = await page.evaluate((n) => {
    const el = [...document.querySelectorAll('[aria-label]')]
      .filter((e) => (e.getAttribute('aria-label') || '').toLowerCase().includes(n.toLowerCase()))
      .find((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, needle);
  if (!box) return false;
  await page.mouse.click(box.x, box.y);
  return true;
}

const backBox = () =>
  page.evaluate(() => {
    const el = [...document.querySelectorAll('[aria-label="Back"]')].find((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), fromLeft: Math.round(r.left) };
  });

const where = () => page.evaluate(() => location.pathname);

console.log('\n  GETTING BACK OUT OF A LOG SCREEN\n');
let failed = 0;

await page.goto('http://localhost:8081/log', { waitUntil: 'domcontentloaded', timeout: 240000 });
await sleep(12000);

const ROWS = [
  ['Food and drink', '/log/food-history'],
  ['Hydration', '/log/water-history'],
  ['Sleep', '/log/sleep'],
  ['Body', '/log/measurements'],
];

for (const [label, expected] of ROWS) {
  const opened = await tap(label);
  await sleep(6000);
  const at = await where();
  if (!opened || at !== expected) {
    console.log(`  FAIL  could not open ${label} (landed on ${at})`);
    failed++;
    await page.goto('http://localhost:8081/log', { waitUntil: 'domcontentloaded' });
    await sleep(8000);
    continue;
  }

  const back = await backBox();
  if (!back) {
    console.log(`  FAIL  ${label}: no back arrow on ${at}`);
    failed++;
  } else {
    const tapped = await tap('Back');
    await sleep(5000);
    const home = await where();
    if (home === '/log') {
      console.log(`  pass  ${label}: arrow at top ${back.top}, ${back.fromLeft} from the left, and it goes back`);
    } else {
      console.log(`  FAIL  ${label}: arrow present but tapping it landed on ${home} (tapped=${tapped})`);
      failed++;
    }
  }

  if ((await where()) !== '/log') {
    await page.goto('http://localhost:8081/log', { waitUntil: 'domcontentloaded' });
    await sleep(8000);
  }
}

console.log(failed === 0 ? '\n  every Log screen can be left\n' : `\n  ${failed} FAILED\n`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
