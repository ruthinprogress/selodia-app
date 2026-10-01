// IS THE MEDICATION SCREEN'S PROMISE TRUE?
//
//   node scripts/probe-medication-card.mjs
//
// The screen has always said: "Selodía will read back what it understood and ask
// you before keeping any of it." Until 1 October 2026 nothing on the server knew
// what a medication list was - no prompt rule, no destination - so the sentence
// was a description of something nobody had built.
//
// Ruth: "on a yes it saves to a 'Medications' Me card (editable later through
// chat like any other Me card). Nothing is saved without a yes."
//
// WHAT IT CHECKS, and the first two are the promise itself:
//
//   READS BACK    the reply names what she said before anything is written
//   NOTHING YET   the card does NOT exist after the first turn. This is the one
//                 that matters: a list of medicines written to her record on the
//                 strength of a model's reading, without her seeing it, is the
//                 exact failure the screen's wording exists to prevent
//   ON A YES      the card appears, titled Medications, with one item each
//   HER WORDS     75mcg is still 75mcg - not 75mg, not "75 micrograms", not
//                 converted. A unit silently changed here is a thousandfold
//                 error sitting quietly in a health record
//   NOT ADVICE    no comment on whether the dose is right and no suggestion to
//                 change anything
//   ONE CARD      a second mention merges rather than starting a second list
//
// Demo account only. It deletes what it makes, at the start of a run as well as
// the end.

import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.selodia.app';
const DEMO = 'unflumpapp@gmail.com';
const TITLE = 'Medications';

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

async function demoSession() {
  const link = await fetch(`${SUPA}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: svc,
    body: JSON.stringify({ type: 'magiclink', email: DEMO }),
  }).then((r) => r.json());
  const hashed = link?.properties?.hashed_token ?? link?.hashed_token;
  const s = await fetch(`${SUPA}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: hashed }),
  }).then((r) => r.json());
  if (!s.access_token) throw new Error('no access token for the demo account');
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

const { token, userId } = await demoSession();
const cards = () =>
  rest(
    'GET',
    `almanac_entries?select=id,title,content&user_id=eq.${userId}&kind=eq.me&title=ilike.*medication*`
  );
// IT CLEARS ITS OWN CONVERSATION TOO, and that is not tidiness.
//
// The card is only half the state. The demo account's chat HISTORY is sent to
// the model on every turn, so a previous run of this probe leaves it saying
// "these are already on your Medications card" - and then not offering, because
// from where it sits nothing has changed. The second run of this probe failed
// for exactly that reason while the code was working perfectly.
//
// Only the probe's own sentences: matched on the text it sends, so a real
// conversation on the demo account is never touched.
const MINE = ['levothyroxine', 'iron as well, 14mg'];
const clean = async () => {
  await rest('DELETE', `almanac_entries?user_id=eq.${userId}&kind=eq.me&title=ilike.*medication*`);
  for (const phrase of MINE) {
    await rest('DELETE', `chat_messages?user_id=eq.${userId}&content=ilike.*${encodeURIComponent(phrase)}*`);
  }
  // And the replies to them, which name the medications back.
  await rest(
    'DELETE',
    `chat_messages?user_id=eq.${userId}&role=eq.assistant&content=ilike.*${encodeURIComponent('Medications card')}*`
  );
  await rest('PATCH', `user_profile?user_id=eq.${userId}`, {
    pending_save: null,
    pending_save_asked_at: null,
  });
};

async function say(message) {
  const res = await fetch(`${API}/api/ask-selodia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

await clean();

try {
  const SAID =
    'These are the things I take regularly: levothyroxine 75mcg each morning, ' +
    'vitamin D 1000iu through the winter, and magnesium at night for sleep.';
  console.log(`\n  "${SAID}"\n`);
  const first = await say(SAID);
  console.log(`        -> ${first.reply}\n`);

  check('it reads back what she said', () => {
    const r = first.reply.toLowerCase();
    ok(r.includes('levothyroxine'), 'it did not name the first medication back to her');
    ok(r.includes('magnesium'), 'it did not name all three back to her');
  });

  check('it keeps her units exactly', () => {
    ok(/75\s*mcg/i.test(first.reply), `"75mcg" came back as something else: ${first.reply}`);
  });

  check('it gives no medical advice', () => {
    // Not an exhaustive guard - a judgement about a dose can be phrased a
    // thousand ways - but these are the shapes that would actually appear.
    const bad =
      /\b(you should (take|stop|start|switch|reduce|increase)|that dose (is|seems|sounds)|interact|contraindicat|too (high|low)|I'?d recommend (taking|stopping))/i;
    ok(!bad.test(first.reply), `the reply gave advice: ${first.reply}`);
  });

  const beforeYes = await cards();
  check('NOTHING is written before she says yes', () =>
    ok(
      (beforeYes ?? []).length === 0,
      `a card already exists: ${JSON.stringify(beforeYes?.[0]?.content)?.slice(0, 200)}`
    )
  );

  const pending = await rest('GET', `user_profile?select=pending_save&user_id=eq.${userId}`);
  check('but an offer IS waiting, so her yes has something to answer', () => {
    const offer = pending?.[0]?.pending_save;
    ok(offer, 'no offer was stored - her "yes" would answer nothing');
    ok(offer.type === 'me', `offer type was ${offer.type}`);
  });

  // ---- yes ---------------------------------------------------------------
  const yes = await say('yes please');
  console.log(`        -> ${yes.reply}\n`);

  const after = await cards();
  console.log(`        card: ${JSON.stringify(after?.[0]?.content)?.slice(0, 420)}\n`);

  check('the card exists', () => ok((after ?? []).length === 1, `found ${after?.length ?? 0} cards`));
  check('it is titled Medications', () =>
    ok(
      String(after?.[0]?.title ?? '').toLowerCase().includes('medication'),
      `titled "${after?.[0]?.title}"`
    )
  );

  const items = Array.isArray(after?.[0]?.content?.items) ? after[0].content.items : [];
  check('each thing is its own item, not one paragraph', () =>
    ok(items.length >= 3, `${items.length} item(s): ${JSON.stringify(items).slice(0, 200)}`)
  );
  check('her dose survived into the record', () =>
    ok(
      /75\s*mcg/i.test(JSON.stringify(items)),
      `75mcg is not on the card: ${JSON.stringify(items).slice(0, 300)}`
    )
  );

  // ---- a second mention merges -------------------------------------------
  console.log('  "I\'ve started taking iron as well, 14mg with breakfast."\n');
  const more = await say("I've started taking iron as well, 14mg with breakfast.");
  console.log(`        -> ${more.reply}\n`);
  await say('yes');

  const merged = await cards();
  check('a later addition joins the SAME card', () =>
    ok((merged ?? []).length === 1, `now ${merged?.length ?? 0} cards - a second list was started`)
  );
  check('and the earlier medications are still on it', () => {
    const blob = JSON.stringify(merged?.[0]?.content ?? {});
    ok(/levothyroxine/i.test(blob), 'the original list was replaced rather than added to');
    ok(/iron/i.test(blob), 'the new one did not arrive');
  });
} finally {
  await clean();
  console.log('        (demo card deleted)');
}

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
