// The segmented control on the Almanac, both positions, and a close crop of it.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = 'C:/Users/ruthi/unflump-app';
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OUT = path.join(HERE, 'log-tabs');

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
if (!session.access_token) { console.error('No session.'); process.exit(1); }
const ref = new URL(SUPA).hostname.split('.')[0];

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  protocolTimeout: 900000,
  defaultViewport: { width: 360, height: 900, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
page.setDefaultTimeout(600000);
await page.evaluateOnNewDocument((k, v) => { try { localStorage.setItem(k, v); } catch {} },
  `sb-${ref}-auth-token`,
  JSON.stringify({
    access_token: session.access_token, refresh_token: session.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
    expires_in: session.expires_in ?? 3600, token_type: 'bearer', user: session.user,
  }));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function tap(label) {
  const box = await page.evaluate((n) => {
    const el = [...document.querySelectorAll('[aria-label]')]
      .filter((e) => (e.getAttribute('aria-label') || '') === n)
      .find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  if (!box) return false;
  await page.mouse.click(box.x, box.y);
  return true;
}
/** The control's own box, so the crop is the thing and not the screen. */
async function trackBox() {
  return page.evaluate(() => {
    const t = document.querySelector('[role="tablist"]');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { x: Math.max(0, r.x - 10), y: Math.max(0, r.y - 10), width: r.width + 20, height: r.height + 20 };
  });
}

const TABS = [
  ['food', '/log/food-history'],
  ['movement', '/log/activity-history'],
  ['measurements', '/log/measurements'],
];

for (const [name, route] of TABS) {
  await page.goto('http://localhost:8081' + route, { waitUntil: 'domcontentloaded', timeout: 600000 });
  await sleep(11000);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`  ${name}: shot`);

  // And with the first day opened, which is where the entries and the swipe are.
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('[aria-label]')].find((e) =>
      /^(Open|Close) /.test(e.getAttribute('aria-label') || '')
    );
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, `${name}-open.png`) });
  console.log(`  ${name}: opened`);
}

console.log(`
  written to ${OUT}
`);
await browser.close();
