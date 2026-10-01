// CAN SHE PUT A FRENCH CLASS IN HER WEEK BY ASKING, AND IS IT THERE AFTERWARDS?
//
//   node scripts/probe-week-add.mjs
//
// Ruth, 1 October 2026: "I can also ask chat directly to add french class on
// thursday night at 7pm." And: "Build that functionality and I will test with
// the french class example."
//
// WHY THIS RUNS AGAINST PRODUCTION AND NOT A STUB. check-week-add.mjs proves the
// plumbing - the days normalise, the time survives, the row gets stamped, the
// sentence names Plans. None of that proves the only remaining question, which
// is whether THE MODEL uses any of it. A prompt rule is not a behaviour until a
// model has read it, and this repo has shipped prompt rules that read
// beautifully and changed nothing.
//
// IT RUNS ON THE DEMO ACCOUNT, NEVER HERS. unflumpapp@gmail.com, the same
// account probe-pipeline-direct uses. Her week has a Gym card in it that was
// already lost once this week and restored by hand; a probe that writes turns
// into her week is a probe that can lose it again.
//
// WHAT IT PROVES, each a way this can be wrong and still look built:
//
//   1  ONE TURN puts it in her week. A direct instruction is not an offer, and
//      the first version of this feature made it one - which produced, on this
//      very probe, "French class, Thursday, 7pm - on your week now" over an
//      empty table. See app/lib/week-entry.ts for both failing runs.
//   2  the day and the time arrive, "thursday night at 7pm" -> thu / 7pm, with
//      the time unparsed, and days_chosen_at stamped. Without that stamp the row
//      exists and the Week screen hides the card, which is indistinguishable
//      from the add having failed.
//   3  it does not ask permission to do what it was just told, and leaves no
//      offer hanging for something already done - which would make her next
//      "yes" write a second French class.
//   4  asking twice leaves ONE French class.
//   5  it can then SAY what is in her week, with the time in her own words.
//      turn_context did not select user_week until today, so this has never once
//      been true.
//
// It cleans up after itself, at the start of the run as well as the end, so a
// run that dies halfway does not leave a French class in the demo week.

import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.selodia.app';
const DEMO = 'unflumpapp@gmail.com';
const ACTIVITY = 'French class';

const E = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const SUPA = E.NEXT_PUBLIC_SUPABASE_URL;
const ANON = E.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = E.SUPABASE_SERVICE_ROLE_KEY;

if (DEMO.includes('ruth')) {
  console.error('Refusing: that is her account, not the demo one.');
  process.exit(1);
}

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

async function demoToken() {
  const link = await fetch(`${SUPA}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: svc,
    body: JSON.stringify({ type: 'magiclink', email: DEMO }),
  }).then((r) => r.json());
  const hashed = link?.properties?.hashed_token ?? link?.hashed_token;
  const session = await fetch(`${SUPA}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: hashed }),
  }).then((r) => r.json());
  if (!session.access_token) throw new Error('no access token for the demo account');
  return { token: session.access_token, userId: session.user?.id };
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

const { token, userId } = await demoToken();
const clean = () =>
  rest('DELETE', `user_week?user_id=eq.${userId}&activity=eq.${encodeURIComponent(ACTIVITY)}`);
await clean();

async function say(message) {
  const res = await fetch(`${API}/api/ask-selodia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

try {
  // ---- the direct instruction: no offer, no yes, just done ----------------
  console.log('\n  "add french class on thursday night at 7pm"\n');
  const asked = await say('add french class on thursday night at 7pm');
  console.log(`        -> ${asked.reply}\n`);

  const rows = await rest(
    'GET',
    `user_week?select=activity,days,time_of_day,days_chosen_at,purpose,cadence` +
      `&user_id=eq.${userId}&activity=eq.${encodeURIComponent(ACTIVITY)}`
  );
  console.log(`        row: ${JSON.stringify(rows?.[0] ?? null)}\n`);

  check('one turn put it in her week - no offer, no yes', () =>
    ok(rows?.length === 1, `found ${rows?.length ?? 0} rows`)
  );
  check('on Thursday', () => ok(rows?.[0]?.days?.includes('thu'), JSON.stringify(rows?.[0]?.days)));
  check('at 7pm, in her words and not a clock', () =>
    ok(/7\s*pm/i.test(rows?.[0]?.time_of_day ?? ''), `time was ${rows?.[0]?.time_of_day}`)
  );
  check('days_chosen_at is stamped, so the card shows on the day', () =>
    ok(rows?.[0]?.days_chosen_at, 'unstamped - under "Let me lead" this card is invisible')
  );
  check('no purpose or cadence was invented for her', () =>
    ok(rows?.[0]?.purpose == null && rows?.[0]?.cadence == null, JSON.stringify(rows?.[0]))
  );

  check('the reply names the day back to her', () => ok(/thursday/i.test(asked.reply), asked.reply));
  check('it does not ask permission to do what it was told', () =>
    ok(
      !/(want|shall|would you like) me to (add|put)/i.test(asked.reply),
      `it asked instead of doing it: ${asked.reply}`
    )
  );
  check('it never sends her to the Almanac', () => ok(!/almanac/i.test(asked.reply), asked.reply));

  // NOTHING LEFT WAITING. An offer stored for something already done means her
  // next "yes" writes a second French class.
  const pending = await rest('GET', `user_profile?select=pending_save&user_id=eq.${userId}`);
  check('no offer is left hanging for a thing already done', () =>
    ok(!pending?.[0]?.pending_save, JSON.stringify(pending?.[0]?.pending_save))
  );

  // ---- asking twice ------------------------------------------------------
  console.log('\n  "add french class on thursday at 7pm" again\n');
  const again = await say('add french class on thursday at 7pm');
  console.log(`        -> ${again.reply}\n`);
  const after = await rest(
    'GET',
    `user_week?select=activity&user_id=eq.${userId}&activity=eq.${encodeURIComponent(ACTIVITY)}`
  );
  check('asking twice leaves one French class, not two', () =>
    ok(after?.length === 1, `found ${after?.length ?? 0}`)
  );

  // ---- and she can be told what is in it ---------------------------------
  console.log('\n  "what have I got on Thursday?"\n');
  const read = await say('what have I got on Thursday?');
  console.log(`        -> ${read.reply}\n`);

  check('it can say what is in her week', () =>
    ok(/french/i.test(read.reply), 'it did not mention the class that is in there')
  );
  check('it does not claim it cannot see her week', () =>
    ok(
      !/(can'?t|cannot|unable to|don'?t have access)[^.!?]{0,40}(see|access|view)/i.test(read.reply),
      read.reply
    )
  );
  check('it reads the time back as she said it', () => ok(/7\s*pm/i.test(read.reply), read.reply));
} finally {
  await clean();
  console.log('        (demo week cleaned up)');
}

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
