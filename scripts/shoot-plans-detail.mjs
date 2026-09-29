// PLANS, SCROLLED, AND BOTH LOG SHEETS OPEN.
//
// The main shoot captures each segment at rest. This one goes after the parts
// that only exist below the fold or behind a tap: Anytime, the Walking card,
// the drag hint, and the two sheets.
//
// FORWARD SLASHES THROUGHOUT. Written with the Write tool rather than a shell
// heredoc, because a Windows path in a heredoc loses its backslashes and
// `C:\Users` becomes an invalid unicode escape. Same family as the rule about
// never sending a regex through a shell.
//
//   node scripts/shoot-plans-detail.mjs

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = 'C:/Users/ruthi/unflump-app';
const OUT =
  'C:/Users/ruthi/AppData/Local/Temp/claude/C--Users-ruthi-unflump-app/32005c44-1c08-4f10-8a48-2d02e8f5d12a/scratchpad/plans-shots';
const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:8081';

const E = {};
for (const line of fs.readFileSync(`${ROOT}/.env.local`, 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) {
    E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const link = await fetch(`${E.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: {
    apikey: E.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${E.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ type: 'magiclink', email: 'unflumpapp@gmail.com' }),
}).then((r) => r.json());

const auth = await fetch(`${E.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify`, {
  method: 'POST',
  headers: { apikey: E.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'magiclink',
    token_hash: link?.properties?.hashed_token ?? link?.hashed_token,
  }),
}).then((r) => r.json());

if (!auth?.access_token) {
  console.error('No session.');
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  defaultViewport: { width: 390, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  args: ['--hide-scrollbars'],
  protocolTimeout: 900_000,
});
const page = await browser.newPage();
const ref = new URL(E.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 600000 });
await page.evaluate(
  (k, v) => window.localStorage.setItem(k, v),
  `sb-${ref}-auth-token`,
  JSON.stringify({
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: auth.user,
  })
);

const openPlans = async () => {
  await page.goto(`${BASE}/plans`, { waitUntil: 'domcontentloaded', timeout: 600000 });
  await new Promise((r) => setTimeout(r, 6500));
};

// react-native-web nests its scroller, so the tallest overflowing div is it.
const scrollToBottom = () =>
  page.evaluate(() => {
    const scrollers = [...document.querySelectorAll('div')].filter(
      (d) => d.scrollHeight > d.clientHeight + 40
    );
    const s = scrollers.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (s) s.scrollTop = s.scrollHeight;
  });

const clickLabel = (match) =>
  page.evaluate((m) => {
    const el = [...document.querySelectorAll('[aria-label]')].find((n) =>
      (n.getAttribute('aria-label') || '').includes(m)
    );
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  }, match);

// THE CADENCE QUESTION IS HERS TO ANSWER, so these shots take it off the
// screen rather than off the record: the dialog element is removed from the
// DOM in the browser and nothing is written. Answering it here would set
// cadence_conflict_asked_at and she would never be asked. It is photographed
// on its own in plans-week-conflict.png.
const hideConflict = () =>
  page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find((n) =>
      (n.textContent || '').startsWith('This says') && n.children.length === 0
    );
    // Walk up to the sheet and drop it, plus the scrim behind it.
    let card = el;
    for (let i = 0; i < 6 && card?.parentElement; i += 1) card = card.parentElement;
    const host = card?.closest('[data-testid], body > div') ?? card;
    if (host && host !== document.body) host.remove();
    return Boolean(el);
  });

await openPlans();
await page.screenshot({ path: path.join(OUT, 'plans-week-conflict.png') });
console.log('  shot plans-week-conflict');

const hid = await hideConflict();
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: path.join(OUT, 'plans-week-top.png') });
console.log(`  shot plans-week-top (conflict ${hid ? 'hidden' : 'not present'})`);

await scrollToBottom();
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: path.join(OUT, 'plans-week-bottom.png') });
console.log('  shot plans-week-bottom');

await openPlans();
const tapped = await clickLabel('Tap to log it');
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: path.join(OUT, 'sheet-log-plan.png') });
console.log(`  shot sheet-log-plan (${tapped ? 'opened' : 'NO CARD FOUND'})`);

await openPlans();
await scrollToBottom();
await new Promise((r) => setTimeout(r, 1200));
const week = await clickLabel('Log the week');
await new Promise((r) => setTimeout(r, 3000));
await page.screenshot({ path: path.join(OUT, 'sheet-log-week.png') });
console.log(`  shot sheet-log-week (${week ? 'opened' : 'BUTTON NOT FOUND'})`);

await openPlans();
const goal = await clickLabel('Open the goal');
await new Promise((r) => setTimeout(r, 3000));
await page.screenshot({ path: path.join(OUT, 'goal.png') });
console.log(`  shot goal (${goal ? 'opened' : 'NOT FOUND'})`);

await browser.close();
console.log(`\n  into ${OUT}`);
