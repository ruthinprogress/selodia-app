// The six Play Store screenshots, to Ruth's brief of 24 September 2026.
//
//   1 Chat           the voice mic must be visible - the old set showed neither
//                    mic nor waves, so the first image hid the whole feature
//   2 Today          filled in: a 5k run logged, hydration part way
//   3 Food log       the redesigned one
//   4 Plans          replaces Hydration, which was cut
//   5 Deadlift       replaces Cycle. Opens from inside Plans
//   6 Almanac        a fuller Health Flower
//
// SHOT FROM THE +store ACCOUNT, never the demo one. These images are public
// the moment the listing is, and the demo account holds her real food logs and
// a real conversation about her son. The seeded account is invented from
// nothing - see scripts/seed-store-account.mjs.
//
// The session is minted server-side and written into localStorage before the
// first navigation, because the app's auth guard redirects to onboarding
// before supabase-js can read tokens out of a URL fragment.

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OUT = path.join(HERE, 'store-shots');
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:8081';
const ROOT = 'C:\\Users\\ruthi\\unflump-app';

const STORE_EMAIL = 'unflumpapp+store@gmail.com';
if (!STORE_EMAIL.includes('+store')) {
  console.error('Refusing: screenshots are only ever taken from the +store account.');
  process.exit(1);
}

const E = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const SUPA = E.NEXT_PUBLIC_SUPABASE_URL || E.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE = E.SUPABASE_SERVICE_ROLE_KEY;
const ANON = E.EXPO_PUBLIC_SUPABASE_ANON_KEY || E.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ---- a session, without anybody typing a password ----------------------
const link = await fetch(`${SUPA}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'magiclink', email: STORE_EMAIL }),
}).then((r) => r.json());

const session = await fetch(`${SUPA}/auth/v1/verify`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'magiclink', token_hash: link?.properties?.hashed_token ?? link?.hashed_token }),
}).then((r) => r.json());

if (!session.access_token) {
  console.error('No session for the store account:', JSON.stringify(session).slice(0, 200));
  process.exit(1);
}

// supabase-js reads this key out of localStorage on boot.
const ref = new URL(SUPA).hostname.split('.')[0];
const STORAGE_KEY = `sb-${ref}-auth-token`;
const STORAGE_VALUE = {
  access_token: session.access_token,
  refresh_token: session.refresh_token,
  expires_at: Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
  expires_in: session.expires_in ?? 3600,
  token_type: 'bearer',
  user: session.user,
};

fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  // A PHONE'S CSS VIEWPORT, NOT A PHONE'S PIXEL COUNT.
  //
  // The first run asked for 1080x1920 CSS pixels, which is a desktop-shaped
  // window that happens to be tall: the app laid its content out across the top
  // third and left sixty per cent of every frame empty. A real phone is about
  // 360x640 CSS pixels at a device pixel ratio of 3, which is the same
  // 1080x1920 image out the other side and the right proportions going in.
  defaultViewport: { width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
});

const page = await browser.newPage();
page.setDefaultTimeout(240000);
await page.evaluateOnNewDocument(
  (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
  STORAGE_KEY,
  JSON.stringify(STORAGE_VALUE)
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A real tap. react-native-web's Pressable listens for pointer events, so
 * element.click() reports success and moves nothing - which is how a row
 * appeared to be tapped three times on 23 September while the screen sat
 * still. Only a match with an actual box counts, because every screen the
 * stack has visited is still in the DOM at zero size.
 */
async function tap(needle) {
  const box = await page.evaluate((n) => {
    const el = [...document.querySelectorAll('[aria-label]')]
      .filter((e) => (e.getAttribute('aria-label') || '').toLowerCase().includes(n.toLowerCase()))
      .find((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, needle);
  if (!box) return false;
  await page.mouse.click(box.x, box.y);
  return true;
}

const clean = () =>
  page.evaluate(() => document.getElementById('error-toast')?.remove()).catch(() => {});

async function shot(name) {
  await clean();
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  const where = await page.evaluate(() => location.pathname);
  console.log(`  ${name.padEnd(22)} at ${where}`);
}

console.log('\n  SHOOTING THE STORE SET, from', STORE_EMAIL, '\n');

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 240000 }).catch(() => {});
await page.waitForSelector('input:not([type=hidden]), textarea', { timeout: 240000 }).catch(() => null);
await sleep(9000);

// 1. Chat. The mic lives beside the composer; nothing to press, only to show.
await shot('1-chat');

// 2. Today, with the run and the water on it.
await page.goto(`${BASE}/today`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await sleep(8000);
await shot('2-today');

// 3. The redesigned Food log.
await page.goto(`${BASE}/log/food-history`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await sleep(8000);
await shot('3-food-log');

// 4. Plans.
await page.goto(`${BASE}/plans`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await sleep(8000);
await shot('4-plans');

// 5. The deadlift, which opens from inside Plans rather than having a route.
if (await tap('Open Lower body strength')) {
  await sleep(6000);
  await shot('5-deadlift-plan');
  // The animatic lives one level further in. The row itself is a completion
  // toggle; the eye beside it opens the movement, which is where the character
  // is. Labelled "About <exercise>" in workout-plan-view.tsx.
  if (await tap('About Barbell deadlift')) {
    await sleep(9000);
    await shot('5-deadlift');
  } else {
    console.log('  5-deadlift            NO DEMO CONTROL FOUND');
  }
} else {
  console.log('  5-deadlift            COULD NOT OPEN THE PLAN - listing labels below');
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll('[aria-label]')]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map((e) => e.getAttribute('aria-label'))
      .slice(0, 25)
  );
  console.log('   ', labels.join(' | '));
}

// 6. Almanac.
await page.goto(`${BASE}/almanac`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await sleep(8000);
await shot('6-almanac');

console.log(`\n  written to ${OUT}\n`);
await browser.close();
