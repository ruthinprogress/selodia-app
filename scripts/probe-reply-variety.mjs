// IS SELODÍA SAYING THE SAME THING OVER AND OVER?
//
//   node scripts/probe-reply-variety.mjs            the demo account
//   node scripts/probe-reply-variety.mjs <email>    somebody else's
//
// WHY THIS EXISTS. Ruth, 25 September 2026: "i feel its a little robotic now,
// saying the same thing often, feels less human than claude chat or chatgpt."
//
// She was right, and nothing in the build could have told her. Replies opening
// with "Got it" went 3% of her turns in August to 39% in the last week. Reply
// length never changed - about 45 words throughout - so nothing got terser;
// the OPENING collapsed onto one phrase.
//
// THE PHRASE IS IN NO PROMPT. It is a feedback loop: the last forty turns go
// into the model's context, a fifth of them opened that way, and it copied
// itself. Every reply written that way makes the next one likelier, which is
// why it accelerated rather than levelling off.
//
// A drift like that is invisible turn by turn - every single reply reads fine -
// and only shows up in aggregate. So it gets measured rather than noticed. This
// reads what is already stored, costs nothing, and exits non-zero when one
// opening owns too much of the last fortnight.

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const EMAIL = process.argv[2] || 'unflumpapp@gmail.com';

// NEVER THE +test ACCOUNT. It belongs to somebody else and is read-only to
// this project in the strongest sense: not read at all.
if (EMAIL.includes('+test')) {
  console.error('Refusing: that account is not ours to look at.');
  process.exit(1);
}

/** Above this share of replies, one opening is a tic rather than a habit. */
const LIMIT_PCT = 20;

/** How far back. Long enough to be a trend, short enough to be current. */
const DAYS = 14;

const E = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#'))
    E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const uid = users.users.find((u) => u.email === EMAIL)?.id;
if (!uid) {
  console.error(`No account for ${EMAIL}.`);
  process.exit(1);
}

const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
const { data, error } = await admin
  .from('chat_messages')
  .select('content, created_at')
  .eq('user_id', uid)
  .eq('role', 'assistant')
  .gte('created_at', since)
  .order('created_at', { ascending: false });

if (error) {
  console.error('Could not read the replies:', error.message);
  process.exit(1);
}

const replies = (data ?? []).map((r) => (r.content ?? '').trim()).filter((c) => c.length > 0);

console.log(`\n  HOW SELODIA OPENS, last ${DAYS} days, ${EMAIL}\n`);

if (replies.length < 20) {
  console.log(`  only ${replies.length} replies in the window - too few to say anything.\n`);
  process.exit(0);
}

/** The first two words, stripped to letters, which is where a tic lives. */
const opening = (text) =>
  text
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.toLowerCase().replace(/[^a-z']/g, ''))
    .filter(Boolean)
    .join(' ');

const counts = new Map();
for (const r of replies) {
  const o = opening(r);
  if (o) counts.set(o, (counts.get(o) ?? 0) + 1);
}

const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
const pct = (n) => Math.round((1000 * n) / replies.length) / 10;

console.log(`  ${replies.length} replies, ${counts.size} different openings`);
console.log(`  average ${Math.round(replies.reduce((n, r) => n + r.split(/\s+/).length, 0) / replies.length)} words\n`);

for (const [o, n] of ranked.slice(0, 8)) {
  const share = pct(n);
  const bar = '#'.repeat(Math.round(share / 2));
  console.log(`  ${String(share).padStart(5)}%  ${bar.padEnd(25)} ${o}  (${n})`);
}

// -------------------------------------------------------------------------
// REPEATS INSIDE ONE CONVERSATION (Ruth, 26 September 2026, item 1: "Test
// against a 10-minute real conversation and log every repeated phrase.")
//
// WHY THIS IS A DIFFERENT MEASUREMENT from everything above, and the more
// important one for voice. The opener count is an average over a fortnight: it
// says the app leans on a phrase, which is a drift worth catching but which
// nobody EXPERIENCES. What a person experiences is hearing the same words twice
// in ten minutes, and that can be true in a conversation while the fortnight
// average looks fine.
//
// A CONVERSATION IS A GAP, NOT A FIELD. Nothing in the schema marks where one
// conversation ends, so it is inferred: replies more than GAP_MINUTES apart are
// different conversations. That is a judgement, and it is the right shape of
// judgement - somebody who comes back after lunch has started again, and
// somebody answering thirty seconds later has not.
const GAP_MINUTES = 30;

/** Three or more words in a row, lowercased - long enough to be a phrase. */
const PHRASE_WORDS = 3;

function phrasesIn(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const out = [];
  for (let i = 0; i + PHRASE_WORDS <= words.length; i++) {
    out.push(words.slice(i, i + PHRASE_WORDS).join(' '));
  }
  return out;
}

// Oldest first, so a conversation reads in the order it happened.
const inOrder = (data ?? [])
  .map((r) => ({ text: (r.content ?? '').trim(), at: Date.parse(r.created_at) }))
  .filter((r) => r.text.length > 0)
  .sort((a, b) => a.at - b.at);

const sessions = [];
for (const reply of inOrder) {
  const last = sessions[sessions.length - 1];
  if (last && reply.at - last[last.length - 1].at <= GAP_MINUTES * 60_000) last.push(reply);
  else sessions.push([reply]);
}

const worst = [];
for (const session of sessions) {
  if (session.length < 3) continue; // Two replies cannot establish a habit.
  const seen = new Map();
  for (const reply of session) {
    // Once per reply: a phrase repeated inside one long answer is a writing
    // tic, not the thing she is describing, which is hearing it turn after turn.
    for (const phrase of new Set(phrasesIn(reply.text))) {
      seen.set(phrase, (seen.get(phrase) ?? 0) + 1);
    }
  }
  const repeats = [...seen.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1]);
  if (repeats.length > 0) {
    worst.push({
      when: new Date(session[0].at),
      turns: session.length,
      minutes: Math.round((session[session.length - 1].at - session[0].at) / 60_000),
      repeats,
    });
  }
}

console.log(`
  REPEATED PHRASES WITHIN ONE CONVERSATION  (${sessions.length} conversations)
`);
if (worst.length === 0) {
  console.log('  none - no three-word phrase was used twice in one conversation.\n');
} else {
  for (const w of worst.sort((a, b) => b.repeats[0][1] - a.repeats[0][1]).slice(0, 5)) {
    const day = w.when.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    console.log(`  ${day}, ${w.turns} replies over ${w.minutes} min:`);
    for (const [phrase, n] of w.repeats.slice(0, 6)) {
      console.log(`     ${n}x  "${phrase}"`);
    }
    console.log();
  }
}

const [topOpening, topCount] = ranked[0];
const topPct = pct(topCount);

console.log();
// ── IS IT GETTING BETTER? ────────────────────────────────────────────────────
//
// A fourteen-day window spans the rebuild, so a single percentage is an average
// of two different apps. The new reply path went live at 09:55 on 28 September
// 2026; the prompt it uses was rebuilt the evening before. Everything from the
// 27th onwards is the new era and everything before it is the old one.
//
// SAID AS COUNTS, NOT ONLY PERCENTAGES. Four replies out of nine is 44% and means
// almost nothing, and a percentage on its own invites exactly that mistake.
const REBUILD = Date.parse('2026-09-27T00:00:00Z');

const era = (rows) => {
  const counts = new Map();
  for (const t of rows) {
    const o = opening(t);
    if (o) counts.set(o, (counts.get(o) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return { n: rows.length, top: top?.[0] ?? null, hits: top?.[1] ?? 0 };
};

const before = era(inOrder.filter((r) => r.at < REBUILD).map((r) => r.text));
const after = era(inOrder.filter((r) => r.at >= REBUILD).map((r) => r.text));

console.log('  BEFORE AND AFTER THE REBUILD (27 September)\n');
for (const [label, e] of [['before', before], ['since ', after]]) {
  if (e.n === 0) {
    console.log(`    ${label}  no replies in this window`);
  } else if (e.n < 10) {
    console.log(
      `    ${label}  ${e.n} replies - too few to read anything into. Commonest opening "${e.top}" (${e.hits}).`
    );
  } else {
    console.log(
      `    ${label}  ${e.n} replies, commonest opening "${e.top}" at ${e.hits} (${Math.round((e.hits / e.n) * 100)}%)`
    );
  }
}
console.log('');

if (topPct > LIMIT_PCT) {
  console.log(`  FAIL  "${topOpening}" opens ${topPct}% of replies, over the ${LIMIT_PCT}% limit.`);
  console.log('        Length is not the problem - see the average above. The opening is.');
  console.log('        Remember what causes it: the model reads its own last forty turns and');
  console.log('        copies them, so this accelerates on its own once it starts.');
  // THE WINDOW AVERAGE IS NOT THE CURRENT STATE when a fix landed inside it.
  // Without this, a real improvement reads as a failure - and a measurement that
  // reports failure after it has been fixed is a measurement nobody runs again.
  if (after.n >= 10 && after.hits / after.n <= LIMIT_PCT / 100) {
    const pct = Math.round((after.hits / after.n) * 100);
    console.log('');
    console.log('        But that average spans the rebuild of 27 September. Since then the');
    console.log(`        commonest opening is "${after.top}" at ${pct}% of ${after.n} replies, under the limit.`);
    console.log('        The fortnight figure will follow as the older replies age out.');
  }
  console.log('');
  process.exit(1);
}

console.log(`  pass  the commonest opening is ${topPct}% of replies, under the ${LIMIT_PCT}% limit.\n`);
process.exit(0);
