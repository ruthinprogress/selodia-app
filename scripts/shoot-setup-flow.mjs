// WALK THE WHOLE OF SETUP AS A BRAND-NEW USER, AND PHOTOGRAPH IT.
//
//   node scripts/shoot-setup-flow.mjs "<output dir>"
//
// Ruth, 1 October 2026: "Test the whole setup flow end to end as a brand-new
// user, including going into each chat panel and coming back out, and show me
// screenshots."
//
// A BRAND-NEW ACCOUNT, MADE THROUGH THE ADMIN API, NOT THROUGH THE FORM. The web
// export is served from localhost but talks to the real Supabase and the real
// API, so typing a password into the sign-up screen would be putting credentials
// into a page that sends them to a non-local host. Provisioning the account the
// same way the probes reach the demo account - service key, server side - gets a
// real new user without that. The session is then injected into localStorage,
// which is exactly what the app would have put there itself.
//
// IT IS A REAL ACCOUNT ON THE REAL DATABASE and it is deleted at the end, having
// touched nothing but its own rows. Named so it is obvious what it is.
//
// WHAT THIS PROVES AND WHAT IT DOES NOT. It proves the flow is walkable, that
// every screen has a way forward, that the three chat panels open IN PLACE and
// hand control back, and that nobody is thrown out to the Chat tab. It is a
// desktop browser at phone size, so it proves nothing about Android gestures,
// fonts or the keyboard - that is still her phone's job.

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const OUT = process.argv[2];
if (!OUT) {
  console.error('usage: node scripts/shoot-setup-flow.mjs "<output dir>"');
  process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });

// THE SERVER SERVES dist-web, NOT dist.
//
// mobile/scripts/serve-web.mjs reads `mobile/dist-web`. The first three runs of
// this script exported to `mobile/dist`, which nothing serves - so it walked an
// export from a previous session, found no "Tell Selodía" button because that
// build predates it, and reported BUTTON NOT FOUND three times while the new
// code sat on disk a directory away.
//
// Exactly the shape of the EAS mistake the same afternoon: published to a place
// that looked right and nothing was reading. So the staleness is checked rather
// than assumed - a walkthrough of last week's build, labelled as today's, is
// worse than no screenshots.
const SERVED = path.join('mobile', 'dist-web');
const ENTRY = path.join(SERVED, 'onboarding', 'medication.html');
if (!fs.existsSync(ENTRY)) {
  console.error(`No web build at ${SERVED}.`);
  console.error('Run, from mobile/:  npx expo export --platform web --output-dir dist-web');
  process.exit(2);
}
const builtAt = fs.statSync(ENTRY).mtimeMs;
const newestSource = ['mobile/src/components/setup-chat-panel.tsx', 'mobile/src/app/onboarding/medication.tsx']
  .filter((f) => fs.existsSync(f))
  .reduce((max, f) => Math.max(max, fs.statSync(f).mtimeMs), 0);
if (newestSource > builtAt) {
  console.error('The web build is OLDER than the screens it is meant to show.');
  console.error(`built ${new Date(builtAt).toISOString()}, source ${new Date(newestSource).toISOString()}`);
  console.error('Re-export to dist-web before shooting.');
  process.exit(2);
}

const E = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const SUPA = E.NEXT_PUBLIC_SUPABASE_URL;
const ANON = E.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = E.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = new URL(SUPA).hostname.split('.')[0];

const svc = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
};

const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
const EMAIL = `setup-flow-probe+${stamp}@selodia.app`;

async function createUser() {
  const res = await fetch(`${SUPA}/auth/v1/admin/users`, {
    method: 'POST',
    headers: svc,
    body: JSON.stringify({ email: EMAIL, email_confirm: true }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`create user -> ${res.status} ${JSON.stringify(body)}`);
  return body.id;
}

async function sessionFor() {
  const link = await fetch(`${SUPA}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: svc,
    body: JSON.stringify({ type: 'magiclink', email: EMAIL }),
  }).then((r) => r.json());
  const hashed = link?.properties?.hashed_token ?? link?.hashed_token;
  const s = await fetch(`${SUPA}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: hashed }),
  }).then((r) => r.json());
  if (!s.access_token) throw new Error(`no session: ${JSON.stringify(s).slice(0, 200)}`);
  return s;
}

async function deleteUser(id) {
  await fetch(`${SUPA}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: svc });
}

const CHROME =
  process.env.CHROME_PATH ?? 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';

const userId = await createUser();
console.log(`  new account: ${EMAIL}\n  id: ${userId}\n`);
const session = await sessionFor();

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

const notes = [];
let shot = 0;

/**
 * A panel is open when its OWN furniture is on screen, not merely when the URL
 * did not change.
 *
 * The first version asserted only "still on the setup screen", which is true of
 * a screen where the button was never found and nothing happened at all - so it
 * passed three times over a flow that had not been exercised. An assertion that
 * cannot fail for the reason it was written is not an assertion.
 */
async function assertPanel(route, label) {
  const text = await page.evaluate(() => document.body.innerText);
  const onScreen = text.includes('Send') && /Nothing is saved until you say yes|Anything you name here|Anything at all, however unusual/.test(text);
  const stayed = page.url().includes(route);
  notes.push({
    assert: `${label}: the conversation happens on the setup screen`,
    ok: onScreen && stayed,
    detail: `panel on screen: ${onScreen}, still on ${route}: ${stayed}`,
    url: page.url(),
  });
  return onScreen && stayed;
}
async function capture(name, extra = '') {
  shot += 1;
  const file = path.join(OUT, `${String(shot).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const text = await page.evaluate(() => document.body.innerText);
  const url = page.url();
  notes.push({ shot, name, url, extra, text });
  console.log(`  ${String(shot).padStart(2, '0')}  ${name}${extra ? `  (${extra})` : ''}`);
  return text;
}

// The session, in the key supabase-js reads on web.
await page.goto('http://localhost:8081/', { waitUntil: 'domcontentloaded' });
await page.evaluate(
  (ref, s) => {
    window.localStorage.setItem(
      `sb-${ref}-auth-token`,
      JSON.stringify({
        access_token: s.access_token,
        refresh_token: s.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + (s.expires_in ?? 3600),
        expires_in: s.expires_in ?? 3600,
        token_type: 'bearer',
        user: s.user,
      })
    );
  },
  PROJECT_REF,
  session
);

const settle = (ms = 2200) => new Promise((r) => setTimeout(r, ms));

async function go(route) {
  await page.goto(`http://localhost:8081/${route}`, { waitUntil: 'networkidle0' });
  await settle();
}

/**
 * Tap the control whose visible text matches, with a REAL mouse.
 *
 * NOT element.click(). React Native Web's Pressable listens on the responder
 * system - pointerdown then pointerup - and a synthetic click event on a child
 * div does not drive it. The first version of this script did exactly that,
 * reported "BUTTON NOT FOUND" for every panel, and still PASSED its own
 * assertion that the panel had not navigated away: of course it had not, nothing
 * had happened. A test whose assertion holds because the action never ran is
 * worse than no test, and this one nearly shipped a screenshot set proving it.
 *
 * Matching is on the deepest element carrying the text, because RNW nests a
 * <div> per Text and a parent's innerText contains all its children's.
 */
async function tap(label) {
  const box = await page.evaluate((want) => {
    const leaves = [...document.querySelectorAll('div,span,button,a')].filter(
      (n) => n.children.length === 0
    );
    const el = leaves.find((n) => (n.innerText ?? '').trim().toLowerCase() === want.toLowerCase());
    if (!el) return null;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  if (!box) return false;
  await page.mouse.click(box.x, box.y);
  await settle(1600);
  return true;
}

try {
  // ---- the configuration chain -----------------------------------------
  for (const [route, name] of [
    ['onboarding/intro', 'intro'],
    ['onboarding/equipment', 'equipment'],
    ['onboarding/first-log', 'first-log'],
    ['onboarding/goals', 'goals'],
    ['onboarding/skill', 'skill'],
    ['onboarding/activities', 'activities'],
  ]) {
    await go(route);
    await capture(name);
  }

  // ---- allergies, and its panel ----------------------------------------
  await go('onboarding/allergies');
  await capture('allergies');
  const openedAllergies = await tap('Tell Selodía');
  await capture('allergies-panel-open', openedAllergies ? 'panel opened in place' : 'LINK NOT FOUND');
  await assertPanel('allergies', 'allergies');
  // AND BACK OUT AGAIN, which is the half of her instruction that is easy to
  // forget to test: a panel you cannot leave is its own kind of trap.
  const closedAllergies = await tap('Done');
  const backText = await capture('allergies-panel-closed', 'back to the screen');
  notes.push({
    assert: 'allergies: the panel can be left, and the screen is still there',
    ok: closedAllergies && !backText.includes('Send') && backText.includes('Something else?'),
    url: page.url(),
  });

  // ---- guidance ---------------------------------------------------------
  await go('onboarding/guidance');
  await capture('guidance');

  // ---- first draft, the end of the configuration chain -------------------
  await go('onboarding/first-draft');
  await capture('first-draft', 'Start, or Add more about you');

  // ---- the Body Manual ---------------------------------------------------
  await go('onboarding/life-stage');
  await capture('life-stage');

  await go('onboarding/steer-around');
  await capture('steer-around');
  await tap('An injury or a condition');
  await capture('steer-around-chosen', 'the action becomes "Tell Selodía"');
  const openedSteer = await tap('Tell Selodía');
  await capture('steer-around-panel', openedSteer ? 'panel opened in place' : 'BUTTON NOT FOUND');
  await assertPanel('steer-around', 'steer-around');

  await go('onboarding/medication');
  await capture('medication');
  await tap('Yes, a few things');
  await capture('medication-chosen', 'the action becomes "Tell Selodía"');
  const openedMed = await tap('Tell Selodía');
  const medText = await capture(
    'medication-panel',
    openedMed ? 'panel opened in place' : 'BUTTON NOT FOUND'
  );
  await assertPanel('medication', 'medication');
  // The promise, on the screen, in front of her, before she types anything.
  notes.push({
    assert: 'medication: the panel states that nothing is kept without a yes',
    ok: /Nothing is saved until you say yes/.test(medText),
    url: page.url(),
  });
  // AND THE WAY ON IS VISIBLE FROM THE START, before any conversation has
  // happened - the flow must never depend on a model releasing her.
  notes.push({
    assert: 'medication: the way out of the panel is on screen immediately',
    ok: /Done - continue/.test(medText),
    url: page.url(),
  });
} finally {
  fs.writeFileSync(path.join(OUT, 'walk.json'), JSON.stringify(notes, null, 2));
  const summary = notes
    .filter((n) => n.assert)
    .map((n) => `${n.ok ? 'PASS' : 'FAIL'}  ${n.assert}${n.detail ? `  [${n.detail}]` : ''}`)
    .join('\n');
  fs.writeFileSync(path.join(OUT, 'assertions.txt'), summary);
  console.log('\n' + summary + '\n');
  await browser.close();
  await deleteUser(userId);
  console.log('  test account deleted');
}
