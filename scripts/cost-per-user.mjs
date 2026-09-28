// WHAT EACH PERSON ACTUALLY COSTS, from rows rather than from a guess.
//
// The pricing document models a blended £2.09 a user a month from an invented
// user mix - 5% heavy, 20% engaged, 45% typical, 30% lapsed - and from one
// person's conversations, who built the thing. This replaces that with counting.
//
// WRITTEN BEFORE THE TABLE HAD ANYTHING IN IT, deliberately. The waitlist was
// collecting for twenty-six days behind a permission rule that locked out the
// person it was for, and nobody found out until somebody asked. A table with no
// reader is a table nobody will read. See mobile/DECISION_PATTERNS.md.
//
//   node scripts/cost-per-user.mjs           the last 30 days
//   node scripts/cost-per-user.mjs 7         the last 7
//   node scripts/cost-per-user.mjs 30 --csv  the same, for a sheet

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DAYS = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 30);
const CSV = process.argv.includes('--csv');
const USD_GBP = 0.79;

const E = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();

// Paged, because a busy month is more rows than one request returns and a
// truncated read here would understate the bill without saying so.
const rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await admin
    .from('model_usage')
    .select('user_id, call, model, cost_micro_cents, output_tokens, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .range(from, from + 999);
  if (error) {
    console.error('Could not read model_usage:', error.message);
    process.exitCode = 1;
    break;
  }
  rows.push(...data);
  if (data.length < 1000) break;
}

if (rows.length === 0) {
  console.log(`\n  Nothing recorded in the last ${DAYS} days.`);
  console.log('  The table is new (28 September 2026). Give it a few days of real use.\n');
} else {
  // A NULL COST IS NOT A ZERO. It means the model was not in the rate card, and
  // rolling it in as free is how a bill quietly goes missing.
  const unpriced = rows.filter((r) => r.cost_micro_cents === null);
  const byUser = new Map();
  const byCall = new Map();

  for (const r of rows) {
    const cents = (r.cost_micro_cents ?? 0) / 1_000_000;
    const u = byUser.get(r.user_id) ?? { calls: 0, cents: 0, first: r.created_at, last: r.created_at };
    u.calls += 1;
    u.cents += cents;
    u.last = r.created_at;
    byUser.set(r.user_id, u);

    const c = byCall.get(r.call) ?? { calls: 0, cents: 0, out: 0 };
    c.calls += 1;
    c.cents += cents;
    c.out += r.output_tokens;
    byCall.set(r.call, c);
  }

  const total = [...byUser.values()].reduce((a, u) => a + u.cents, 0);

  if (CSV) {
    console.log('user_id,calls,cents,gbp_per_month_at_this_rate');
    for (const [id, u] of byUser) {
      console.log(`${id},${u.calls},${u.cents.toFixed(3)},${((u.cents / 100) * USD_GBP * (30 / DAYS)).toFixed(2)}`);
    }
  } else {
    console.log(`\n  ${rows.length} calls over ${DAYS} days, ${byUser.size} ${byUser.size === 1 ? 'person' : 'people'}\n`);
    console.log('  BY CALL\n');
    for (const [name, c] of [...byCall].sort((a, b) => b[1].cents - a[1].cents)) {
      const share = ((c.cents / total) * 100).toFixed(0);
      console.log(
        `    ${name.padEnd(12)} ${String(c.calls).padStart(6)} calls   ` +
          `${c.cents.toFixed(2).padStart(8)}c   ${share.padStart(3)}% of the bill   ` +
          `${Math.round(c.out / c.calls)} out tokens each`
      );
    }

    console.log('\n  BY PERSON, and what a month at this rate would come to\n');
    for (const [id, u] of [...byUser].sort((a, b) => b[1].cents - a[1].cents)) {
      const month = (u.cents / 100) * USD_GBP * (30 / DAYS);
      console.log(
        `    ${id.slice(0, 8)}   ${String(u.calls).padStart(6)} calls   ` +
          `${u.cents.toFixed(2).padStart(8)}c   £${month.toFixed(2)}/month`
      );
    }

    const meanMonth = (total / byUser.size / 100) * USD_GBP * (30 / DAYS);
    console.log(`\n  MEASURED AVERAGE   £${meanMonth.toFixed(2)} a user a month`);
    console.log('  The pricing document models £2.09 from an invented mix. This is counted.\n');

    if (byUser.size < 5) {
      console.log('  With this few people the average is a description of them, not a forecast.\n');
    }
  }

  if (unpriced.length > 0) {
    const models = [...new Set(unpriced.map((r) => r.model))];
    console.log(
      `  ${unpriced.length} calls have NO COST, because ${models.join(', ')} ` +
        `${models.length === 1 ? 'is' : 'are'} not in the rate card in app/lib/model-cost.ts.\n` +
        '  They are counted in the call totals and NOT in the money. Add the rate.\n'
    );
  }

  console.log('  Not counted here, and small: the allergy gate\'s layer-4 check (a Haiku');
  console.log('  call on the few turns that reach it) and the report writer. Both were');
  console.log('  left out rather than threaded through a safety signature for accounting.\n');
}
