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

const [topOpening, topCount] = ranked[0];
const topPct = pct(topCount);

console.log();
if (topPct > LIMIT_PCT) {
  console.log(`  FAIL  "${topOpening}" opens ${topPct}% of replies, over the ${LIMIT_PCT}% limit.`);
  console.log('        Length is not the problem - see the average above. The opening is.');
  console.log('        Remember what causes it: the model reads its own last forty turns and');
  console.log('        copies them, so this accelerates on its own once it starts.\n');
  process.exit(1);
}

console.log(`  pass  the commonest opening is ${topPct}% of replies, under the ${LIMIT_PCT}% limit.\n`);
process.exit(0);
