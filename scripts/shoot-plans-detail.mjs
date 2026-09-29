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

// ---------------------------------------------------------------- READ ONLY
//
// THIS SHOOT RUNS AGAINST RUTH'S REAL ACCOUNT, AND ON 29 SEPTEMBER IT CHANGED
// IT. Clicking by fuzzy label match reached the cadence dialog and answered a
// question that was hers to answer, took Gym off Monday and Thursday, and
// moved Rocket yoga to Sunday. All three were restored by hand.
//
// check-food-parse.mjs already had the rule written down - "it is her
// production database, and a verification that changes the thing it is
// verifying is not a verification" - and this file did not follow it.
//
// PROMISING TO CLICK CAREFULLY IS NOT A FIX. The guard belongs at the write,
// so every mutating request to Supabase is aborted at the network layer.
// Screens still render, sheets still open, buttons still respond - and
// nothing any click does can reach the database.
const HOST = new URL(E.NEXT_PUBLIC_SUPABASE_URL).host;
const blocked = [];
await page.setRequestInterception(true);
page.on('request', (req) => {
  const url = req.url();
  const method = req.method();
  const mutating = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
  // The auth endpoints POST to sign in, which is how the session exists at
  // all. Everything else that writes is refused.
  const isAuth = url.includes('/auth/v1/');
  if (mutating && url.includes(HOST) && !isAuth) {
    blocked.push(`${method} ${url.replace(/^https?:\/\/[^/]+/, '')}`);
    void req.abort();
    return;
  }
  void req.continue();
});

// A CRASH MUST ARRIVE AS A MESSAGE, NOT AS A BLANK SCREENSHOT. A red-screen
// error in React Native web renders as an ordinary-looking page, so a shoot
// that silently photographs a broken app is worse than one that fails.
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));
page.on('console', (m) => {
  if (m.type() === 'error') pageErrors.push(m.text().slice(0, 300));
});
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

// ONLY CONTROLS, AND ONLY BY LABEL. Restricting to role=button/tab/checkbox
// stops a match landing on a container that happens to contain the words.
const clickLabel = (match) =>
  page.evaluate((m) => {
    const ROLES = ['button', 'tab', 'checkbox', 'link'];
    const el = [...document.querySelectorAll('[aria-label]')].find(
      (n) =>
        (n.getAttribute('aria-label') || '').includes(m) &&
        ROLES.includes(n.getAttribute('role') || '')
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
const tapped = await clickLabel('Ballet');
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

// The tap sheet's "Move to…", and the sheet it opens. Ruth's accessible
// route, so it matters that it works without any gesture at all.
await openPlans();
await clickLabel('Ballet');
await new Promise((r) => setTimeout(r, 2000));
const moveLink = await clickLabel('to another day');
await new Promise((r) => setTimeout(r, 2000));
await page.screenshot({ path: path.join(OUT, 'sheet-move.png') });
console.log(`  shot sheet-move (${moveLink ? 'opened' : 'MOVE LINK NOT FOUND'})`);

// ---------------------------------------------------------------- THE DRAG
//
// WHAT THIS DOES AND DOES NOT PROVE. react-native-gesture-handler has a
// separate web implementation, so a pass here is NOT proof that the gesture
// arbitrates correctly against Android's native ScrollView. What it does
// exercise, and exercise for real, is everything the phone also runs: the
// long-press activation, measuring the drop zones, hit-testing the finger
// against them, the highlight, and the drop. If the wiring is wrong this
// fails here too.
//
// Writes are blocked, so the move cannot land - the point is the mid-drag
// frame, which is where "nothing happens" would show itself.
await openPlans();
// The cadence dialog is a Modal over the whole week, so a touch aimed at a
// card lands on the scrim. Hiding it is what makes this a test of the drag
// rather than a test of the dialog. Nothing is answered - see hideConflict.
await hideConflict();
await new Promise((r) => setTimeout(r, 600));
const box = await page.evaluate(() => {
  const el = [...document.querySelectorAll('[aria-label]')].find(
    (n) =>
      (n.getAttribute('aria-label') || '').startsWith('Ballet') &&
      (n.getAttribute('role') || '') === 'button'
  );
  const thu = [...document.querySelectorAll('[aria-label]')].find((n) =>
    (n.getAttribute('aria-label') || '').includes('Add an activity to Thu')
  );
  if (!el || !thu) return null;
  const a = el.getBoundingClientRect();
  const b = thu.getBoundingClientRect();
  return {
    from: { x: a.x + a.width / 2, y: a.y + a.height / 2 },
    to: { x: b.x - 80, y: b.y + b.height / 2 },
  };
});

if (!box) {
  console.log('  DRAG: could not find the Ballet pill or the Thursday row');
} else {
  await page.touchscreen.touchStart(box.from.x, box.from.y);
  // Past activateAfterLongPress(250) before moving a pixel.
  await new Promise((r) => setTimeout(r, 500));
  // In steps, because one jump can be read as a teleport rather than a pan.
  for (let i = 1; i <= 6; i += 1) {
    await page.touchscreen.touchMove(
      box.from.x + ((box.to.x - box.from.x) * i) / 6,
      box.from.y + ((box.to.y - box.from.y) * i) / 6
    );
    await new Promise((r) => setTimeout(r, 90));
  }
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(OUT, 'drag-midway.png') });
  const lifted = await page.evaluate(() =>
    document.body.innerText.split('Ballet').length - 1
  );
  console.log(`  shot drag-midway (Ballet appears ${lifted}x - 2 means the carried preview is drawn)`);
  await page.touchscreen.touchEnd();
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT, 'drag-after.png') });
  console.log('  shot drag-after');
}

await openPlans();
const goal = await clickLabel('Open the goal');
await new Promise((r) => setTimeout(r, 3000));
await page.screenshot({ path: path.join(OUT, 'goal.png') });
console.log(`  shot goal (${goal ? 'opened' : 'NOT FOUND'})`);

if (blocked.length > 0) {
  console.log('');
  console.log(`  ${blocked.length} WRITE(S) BLOCKED - the shoot tried to change her data:`);
  for (const b of [...new Set(blocked)].slice(0, 12)) console.log('    ' + b);
} else {
  console.log('');
  console.log('  no writes attempted');
}

if (pageErrors.length > 0) {
  console.log('');
  console.log(`  ${pageErrors.length} PAGE ERROR(S):`);
  for (const e of [...new Set(pageErrors)].slice(0, 12)) console.log('    ' + e);
} else {
  console.log('');
  console.log('  no page errors');
}

await browser.close();
console.log(`\n  into ${OUT}`);
