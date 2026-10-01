// THE SETUP CHAT PANEL, AND THE WRITES IT REPORTS.
//
//   node scripts/probe-setup-panel-writes.mjs
//
// Ruth, 1 October 2026: "Your production tests passed for the week, but my phone
// showed 'That did not save' in the setup chat panel. Test that exact path, not
// only the main chat."
//
// SHE IS RIGHT THAT I TESTED THE WRONG THING, and right to be suspicious of the
// pass. My week probe posts to /api/ask-selodia with `{ message }`, and so does
// SetupChatPanel - identical bodies, identical route. So the probe did cover the
// server half of her path. What it did NOT cover is the thing that was actually
// broken: the ALLERGY and WEEK writes were missing from `wroteThisTurn`, so
// falseClaimNote appended "That did not save" to a reply whose write had
// succeeded. My probe asserted the ROW existed, which it did, and never read the
// sentence underneath.
//
// A test that checks the database and ignores what the person is told will pass
// every time the app lies to her. So this one asserts both, and asserts them on
// the two things she actually did:
//
//   the allergy she disclosed in the setup panel (sardines), and
//   the week entries chat claimed to have written.
//
// IT SENDS WHAT THE PANEL SENDS. Same route, same body shape, same absence of a
// `voice` flag. If that ever diverges from components/setup-chat-panel.tsx this
// probe is testing a path nobody uses, so the shape is asserted against the
// component source rather than trusted.

import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.selodia.app';
const DEMO = 'unflumpapp@gmail.com';

const E = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const SUPA = E.NEXT_PUBLIC_SUPABASE_URL;
const ANON = E.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = E.SUPABASE_SERVICE_ROLE_KEY;

const svc = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function rest(method, q, body) {
  const res = await fetch(`${SUPA}/rest/v1/${q}`, {
    method,
    headers: svc,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${q} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function session() {
  const link = await fetch(`${SUPA}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: svc,
    body: JSON.stringify({ type: 'magiclink', email: DEMO }),
  }).then((r) => r.json());
  const s = await fetch(`${SUPA}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'magiclink',
      token_hash: link?.properties?.hashed_token ?? link?.hashed_token,
    }),
  }).then((r) => r.json());
  if (!s.access_token) throw new Error('no access token');
  return { token: s.access_token, userId: s.user?.id };
}

let pass = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL  ${name}\n          ${e.message}`);
    failures.push(name);
  }
}
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

// THE DENIAL ITSELF. If this appears beside a write that landed, the app has
// contradicted itself about her own data - which is the whole subject here.
const DENIAL = /did ?n[o']?t save|is not in your record|nothing was saved/i;

const { token, userId } = await session();

// Exactly what SetupChatPanel posts.
async function panelSays(message) {
  const res = await fetch(`${API}/api/ask-selodia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

const TEST_ALLERGY = 'anchovies';
const TEST_ACTIVITY = 'Pilates class';
const clean = async () => {
  await rest('DELETE', `allergies?user_id=eq.${userId}&name=eq.${TEST_ALLERGY}`);
  await rest(
    'DELETE',
    `user_week?user_id=eq.${userId}&activity=eq.${encodeURIComponent(TEST_ACTIVITY)}`
  );
  await rest(
    'DELETE',
    `chat_messages?user_id=eq.${userId}&content=ilike.*${TEST_ALLERGY}*`
  );
  await rest(
    'DELETE',
    `chat_messages?user_id=eq.${userId}&content=ilike.*${encodeURIComponent(TEST_ACTIVITY)}*`
  );
  await rest('PATCH', `user_profile?user_id=eq.${userId}`, {
    pending_save: null,
    pending_save_asked_at: null,
  });
};

console.log('\n  THE SETUP PANEL PATH\n');

// The panel and this probe must be sending the same thing.
check('this probe posts what the panel posts', () => {
  const src = fs.readFileSync('mobile/src/components/setup-chat-panel.tsx', 'utf8');
  ok(
    /authedPost<\{ reply\?: string \}>\('\/api\/ask-selodia', \{ message \}\)/.test(src),
    'SetupChatPanel no longer posts { message } to /api/ask-selodia, so this probe tests a path nobody uses'
  );
});

await clean();

try {
  // ---- the allergy, which is what she did in the panel --------------------
  console.log(`\n  "I can't eat ${TEST_ALLERGY}"\n`);
  const a = await panelSays(`I can't eat ${TEST_ALLERGY}.`);
  console.log(`        -> ${a.reply}\n`);

  const stored = await rest(
    'GET',
    `allergies?select=name,kind&user_id=eq.${userId}&name=eq.${TEST_ALLERGY}`
  );
  console.log(`        row: ${JSON.stringify(stored?.[0] ?? null)}\n`);

  check('the allergy is written', () =>
    ok((stored ?? []).length === 1, `found ${stored?.length ?? 0} rows`)
  );
  check('and the reply does NOT deny it', () =>
    ok(
      !DENIAL.test(a.reply),
      `the row exists and the app said otherwise: "${a.reply}". This is the sardines bug.`
    )
  );

  // ---- the week, same panel, same route -----------------------------------
  console.log(`\n  "add ${TEST_ACTIVITY} on tuesday at 6pm"\n`);
  const w = await panelSays(`Add ${TEST_ACTIVITY} on Tuesday at 6pm.`);
  console.log(`        -> ${w.reply}\n`);

  const week = await rest(
    'GET',
    `user_week?select=activity,days,time_of_day&user_id=eq.${userId}&activity=eq.${encodeURIComponent(TEST_ACTIVITY)}`
  );
  console.log(`        row: ${JSON.stringify(week?.[0] ?? null)}\n`);

  check('the week entry is written', () =>
    ok((week ?? []).length === 1, `found ${week?.length ?? 0} rows`)
  );
  check('and the reply does NOT deny it', () =>
    ok(
      !DENIAL.test(w.reply),
      `the row exists and the app said otherwise: "${w.reply}". This is what she saw in the panel.`
    )
  );
  check('it says which day', () => ok(/tuesday/i.test(w.reply), w.reply));
} finally {
  await clean();
  console.log('        (cleaned up)');
}

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
