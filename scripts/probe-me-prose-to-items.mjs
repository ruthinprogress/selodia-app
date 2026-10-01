// CAN A PROSE ME CARD BE TURNED INTO ITEMS BY TALKING TO CHAT?
//
//   node scripts/probe-me-prose-to-items.mjs
//
// Ruth, 1 October 2026: "Don't run the conversion script. Chat is the only way a
// user can see and change a Me card, so that's the route that has to work.
// Confirm, with a test against the real chat path (not a unit check), that
// restating a routine in chat converts an existing prose Me card into items,
// replaces rather than appends, and moves superseded text into history."
//
// She is right that this is the only test worth having. A migration script would
// fix HER card once; it would do nothing for the next person, and it would prove
// nothing about the path everybody actually uses. A unit test on mergeItems
// proves the merge function works and says nothing about whether the route calls
// it correctly, which is where this repo's bugs keep turning out to live.
//
// THREE THINGS, EACH FROM HER SENTENCE:
//
//   converts   the card ends up with structured items, not a paragraph
//   replaces   restating a product CHANGES it rather than adding a second copy,
//              and does not make a second card
//   history    the superseded prose is archived, not deleted and not left
//              sitting in the body contradicting the new items
//
// THE THIRD IS THE ONE AT RISK. me-items.ts exports archiveProse for exactly
// this, and its own header describes the failure it exists to prevent: "a detail
// line from nine days earlier that still said [the old thing]" next to the new
// items. A grep says nothing calls it.
//
// IT RUNS ON THE DEMO ACCOUNT, never hers - she wants to do the real one herself
// afterwards. It creates its own prose card, talks to production, checks the
// result and deletes what it made, at the start of a run as well as the end.

import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.selodia.app';
const DEMO = 'unflumpapp@gmail.com';
const TITLE = 'Evening skincare (probe)';

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
// IT CLEARS ITS OWN CONVERSATION TOO.
//
// The card is only half the state: the demo account's chat history goes to the
// model on every turn, so a previous run leaves it discussing a routine that no
// longer exists and answering from that instead of from the card in front of it.
// Only this probe's own sentences are removed, matched on the text it sends.
const clean = async () => {
  await rest('DELETE', `almanac_entries?user_id=eq.${userId}&title=eq.${encodeURIComponent(TITLE)}`);
  await rest(
    'DELETE',
    `chat_messages?user_id=eq.${userId}&content=ilike.*${encodeURIComponent('skincare (probe)')}*`
  );
  await rest(
    'DELETE',
    `chat_messages?user_id=eq.${userId}&content=ilike.*${encodeURIComponent('niacinamide')}*`
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

const card = () =>
  rest('GET', `almanac_entries?select=id,title,kind,content&user_id=eq.${userId}&title=eq.${encodeURIComponent(TITLE)}`);

await clean();

// THE CARD AS IT EXISTED BEFORE ITEMS: one paragraph in `detail`, which is the
// shape every Me card written before 30 September is still in.
const PROSE =
  'Cleanser, then vitamin C serum, then moisturiser. Retinol twice a week on alternate nights. SPF every morning without fail.';

try {
  await rest('POST', 'almanac_entries', [
    {
      user_id: userId,
      kind: 'me',
      title: TITLE,
      category: 'Skincare',
      content: {
        section: 'Skincare',
        why: 'Texture and evenness.',
        status: 'Active',
        detail: PROSE,
      },
    },
  ]);
  console.log('\n  a prose card exists:\n   ', PROSE, '\n');

  // ---- restate it in chat, the way she would -----------------------------
  const RESTATE =
    `My ${TITLE} has changed. It is now: cleanser first, then niacinamide serum ` +
    `for redness, then a richer moisturiser. Retinol is three nights a week now, not two. ` +
    `Please update my Me tab.`;
  console.log(`  "${RESTATE}"\n`);
  const first = await say(RESTATE);
  console.log(`        -> ${first.reply}\n`);

  const pendingRow = await rest('GET', `user_profile?select=pending_save&user_id=eq.${userId}`);
  const offer = pendingRow?.[0]?.pending_save ?? null;
  console.log(`        offer: ${JSON.stringify(offer)?.slice(0, 300)}\n`);

  check('it offers to update the card, using the SAME title', () => {
    ok(offer, 'nothing was offered, so there is nothing to say yes to');
    ok(offer.type === 'me', `offered type "${offer.type}"`);
    ok(
      String(offer.title).toLowerCase().includes('skincare'),
      `offered title "${offer.title}" - a different title makes a SECOND card`
    );
  });

  check('the offer carries ITEMS rather than another paragraph', () => {
    const items = offer?.content?.items;
    ok(Array.isArray(items) && items.length > 0, `content was ${JSON.stringify(offer?.content)}`);
  });

  // ---- say yes ------------------------------------------------------------
  const yes = await say('yes please');
  console.log(`        -> ${yes.reply}\n`);

  const after = await card();
  console.log(`        card now: ${JSON.stringify(after?.[0]?.content)}\n`);

  check('there is still exactly ONE card, not two', () =>
    ok(after?.length === 1, `found ${after?.length ?? 0} cards titled "${TITLE}"`)
  );

  const content = after?.[0]?.content ?? {};
  const items = Array.isArray(content.items) ? content.items : [];

  check('the card is now items', () =>
    ok(items.length > 0, `no items on the card: ${JSON.stringify(content).slice(0, 200)}`)
  );

  check('it REPLACED rather than appended - no duplicate products', () => {
    const names = items.map((i) => String(i.name ?? '').trim().toLowerCase());
    const dupes = names.filter((n, i) => n && names.indexOf(n) !== i);
    ok(dupes.length === 0, `the same product appears twice: ${dupes.join(', ')}`);
  });

  check('the superseded prose is GONE from the body', () => {
    // The failure me-items.ts was written to prevent: the old paragraph sitting
    // beside the new items, saying something different about the same routine.
    ok(
      !content.detail,
      `the old paragraph is still in detail, contradicting the items: "${content.detail}"`
    );
  });

  check('and it is IN HISTORY rather than deleted', () => {
    const history = Array.isArray(content.history) ? content.history : [];
    const archived = history.some((h) =>
      String(h?.reason ?? '').toLowerCase().includes('vitamin c')
    );
    ok(
      archived,
      `her earlier wording is nowhere: history is ${JSON.stringify(history).slice(0, 200)}. ` +
        'Her rule was "archive the old prose in history, delete nothing".'
    );
  });
} finally {
  await clean();
  console.log('        (probe card deleted)');
}

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
