// THE LOGS, READ BACK. What was slow, what broke, and what happened on one turn.
//
// Ruth, 28 September 2026, on whether to pay $25/month for Supabase Pro: "can
// you keep the logs you need (errors, turn timings, fallbacks) in our own
// database or another free option?" This is the reader for the answer.
//
// WHAT IT REPLACES. Vercel's free tier retains nothing - a live stream and no
// history - so a question asked an hour after the event has no source. Twice on
// 28 September that ended an investigation. Pro would buy seven days. This keeps
// them indefinitely, next to the data they are about, for nothing.
//
//   node scripts/turn-log.mjs              today
//   node scripts/turn-log.mjs 7            the last 7 days
//   node scripts/turn-log.mjs 7 --errors   only what broke
//   node scripts/turn-log.mjs --turn <id>  everything about one turn

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const DAYS = Number(args.find((a) => /^\d+$/.test(a)) ?? 1);
const ERRORS_ONLY = args.includes('--errors');
const TURN = args[args.indexOf('--turn') + 1] && args.includes('--turn') ? args[args.indexOf('--turn') + 1] : null;

const E = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ms = (n) => (n == null ? '    -' : `${String(Math.round(n)).padStart(5)}`);

// PHASES IN TIME ORDER, NOT IN KEY ORDER.
//
// The marks are stored as jsonb, and Postgres does NOT preserve the order the
// keys went in - it reorders them by length and then bytewise. The first version
// of this differenced them in whatever order they came back and printed phases
// of MINUS three and a half seconds, which is how the bug announced itself.
//
// Every mark is elapsed-since-start, so sorting by value recovers the true
// sequence whatever the storage did with it.
function phases(marks) {
  return Object.entries(marks ?? {})
    .filter(([name]) => name !== 'total')
    .sort((a, b) => a[1] - b[1])
    .map(([name, at], i, all) => [name, at - (i === 0 ? 0 : all[i - 1][1])]);
}

if (TURN) {
  // ONE TURN, EVERYTHING ABOUT IT. Three tables, because the three kinds of
  // record were built at different times for different reasons and joining them
  // here is cheaper than merging them in the schema.
  const [{ data: diag }, { data: fell }, { data: usage }] = await Promise.all([
    admin.from('turn_diagnostics').select('*').eq('turn_id', TURN).order('created_at'),
    admin.from('reply_path_fallbacks').select('*').eq('turn_id', TURN),
    admin.from('model_usage').select('call, model, cost_micro_cents, output_tokens').eq('turn_id', TURN),
  ]);

  console.log(`\n  TURN ${TURN}\n`);
  for (const d of diag ?? []) {
    if (d.kind === 'timing') {
      console.log(`  ${d.created_at.slice(11, 19)}  ${d.label}  ${d.total_ms}ms`);
      for (const [name, took] of phases(d.detail)) {
        console.log(`      ${name.padEnd(24)} +${took}ms`);
      }
    } else {
      console.log(`  ${d.created_at.slice(11, 19)}  ERROR  ${d.label}`);
      console.log(`      ${JSON.stringify(d.detail)}`);
    }
  }
  for (const f of fell ?? []) console.log(`  FALLBACK  ${f.reason} - ${f.detail}`);
  const spent = (usage ?? []).reduce((a, u) => a + (u.cost_micro_cents ?? 0), 0) / 1_000_000;
  if (usage?.length) {
    console.log(`  MODEL CALLS  ${usage.map((u) => u.call).join(', ')}  ${spent.toFixed(3)}c`);
  }
  if (!diag?.length && !fell?.length && !usage?.length) console.log('  Nothing recorded for that turn.\n');
  else console.log('');
} else {
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();

  const { data, error } = await admin
    .from('turn_diagnostics')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) {
    console.error('Could not read turn_diagnostics:', error.message);
    process.exitCode = 1;
  } else if (!data.length) {
    console.log(`\n  Nothing recorded in the last ${DAYS} day(s).`);
    console.log('  The table is new (28 September 2026). Use the app and look again.\n');
  } else {
    const errors = data.filter((d) => d.kind === 'error');
    const timings = data.filter((d) => d.kind === 'timing');

    console.log(`\n  ${data.length} records over ${DAYS} day(s)\n`);

    if (errors.length > 0) {
      console.log('  WHAT BROKE\n');
      for (const e of errors) {
        console.log(`    ${e.created_at.slice(0, 19).replace('T', ' ')}  ${e.label}`);
        console.log(`        turn ${e.turn_id ?? '-'}  ${JSON.stringify(e.detail)}`);
      }
      console.log('');
    } else {
      console.log('  Nothing broke.\n');
    }

    if (!ERRORS_ONLY && timings.length > 0) {
      const by = { voice: [], typed: [] };
      for (const t of timings) by[t.voice ? 'voice' : 'typed'].push(t.total_ms ?? 0);

      console.log('  HOW SLOW\n');
      for (const [kind, xs] of Object.entries(by)) {
        if (xs.length === 0) continue;
        const sorted = [...xs].sort((a, b) => a - b);
        const pick = (f) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))];
        console.log(
          `    ${kind.padEnd(6)} ${String(xs.length).padStart(4)} turns   ` +
            `median ${ms(pick(0.5))}ms   90th ${ms(pick(0.9))}ms   worst ${ms(sorted[sorted.length - 1])}ms`
        );
      }

      // WHERE THE TIME WENT, averaged over the phases every turn records. This
      // is the question Vercel's log could answer for twenty minutes and then
      // could not.
      const spent = {};
      for (const t of timings) {
        for (const [name, took] of phases(t.detail)) (spent[name] ??= []).push(took);
      }
      console.log('\n  WHERE THE TIME GOES, median per phase\n');
      const rows = Object.entries(spent)
        .map(([name, xs]) => [name, [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)], xs.length])
        .sort((a, b) => b[1] - a[1]);
      for (const [name, med, n] of rows) {
        console.log(`    ${name.padEnd(24)} ${ms(med)}ms   (${n} turns)`);
      }
      console.log('');
    }
  }
}
