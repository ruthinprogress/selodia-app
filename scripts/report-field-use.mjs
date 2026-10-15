// WHICH OF THE DECIDING TOOL'S FIELDS ARE ACTUALLY USED.
//
//   node scripts/report-field-use.mjs [days]
//
// The read half of the instrumentation added 15 October 2026 (Ruth: "yes, add
// the instrumentation now"). The write half is recordDecisionFields in
// app/lib/turn-diagnostics.ts; this is what turns it into an answer.
//
// WHAT IT IS FOR. The deciding call produces 327 to 1,401 output tokens on a
// 13.6s turn, and the tool it fills offers around thirty optional fields. The
// saving is to stop offering the ones nobody uses - but nobody could name
// those, so they are counted first.
//
// HOW TO READ IT, and this is the part worth being careful about:
//
//   `reply` and `classification` are REQUIRED by the schema. They appear on
//   every row, mean nothing, and are marked as such below.
//
//   A FIELD AT ZERO IS A CANDIDATE, NOT A VERDICT. Half of these exist because
//   something went wrong once, which is exactly the shape of a field that
//   fires rarely and matters enormously on the turn it fires. Before cutting
//   one, read why it was added. Zero over a fortnight on ONE person's account
//   is weak evidence about everybody.
//
//   AND CUTTING IS NOT FREE. The tool schema has its own cache breakpoint, so
//   a tool whose shape varies per turn breaks that cache every turn and can
//   cost more than the fields save - only a few STABLE variants are safe. This
//   is also the call carrying the distress classification, so any change gets
//   the full safety comparison first.
//
// Read-only. Names and counts only - there are no values in this table.

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const DAYS = Number(process.argv[2] ?? 14);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase
  .from('turn_diagnostics')
  .select('label, voice, detail, created_at')
  .eq('kind', 'fields')
  .gt('created_at', new Date(Date.now() - DAYS * 24 * 3600 * 1000).toISOString())
  .order('created_at', { ascending: false })
  .limit(5000);
if (error) throw new Error(error.message);

// NOT process.exit, WHICH LOOKS LIKE A CRASH. Called with the Supabase
// client's socket still open it aborts the process on Windows - "Assertion
// failed: !(handle->flags & UV_HANDLE_CLOSING)" - printed AFTER the report, so
// a run that finished perfectly well ends in an assertion failure. Letting the
// script fall off its end lets node close things in its own order.
const nothingYet = data.length === 0;
if (nothingYet) {
  console.log(
    `\n  Nothing recorded in the last ${DAYS} days.\n\n` +
      '  The instrument went in on 15 October 2026 and only records turns that\n' +
      '  reach the classifier. If that date is recent, this is simply early.\n'
  );
}

if (!nothingYet) {
/** Every field the tool can offer, so a field at zero still gets a line. */
const offered = new Set();
const { buildClassifyTool } = await import('file://' + process.cwd().replace(/\\/g, '/') + '/app/lib/safety-classification.ts');
for (const key of Object.keys(buildClassifyTool(['neutral'], false).input_schema.properties)) offered.add(key);

const REQUIRED = new Set(['classification', 'reply']);

const counts = new Map();
let turns = 0;
let led = 0;
for (const row of data) {
  const set = row.detail?.set;
  if (!Array.isArray(set)) continue;
  turns += 1;
  if (row.label === 'led') led += 1;
  for (const field of set) {
    offered.add(field);
    counts.set(field, (counts.get(field) ?? 0) + 1);
  }
}

const rows = [...offered]
  .map((field) => ({ field, used: counts.get(field) ?? 0 }))
  .sort((a, b) => b.used - a.used || a.field.localeCompare(b.field));

console.log(`\n  ${turns} turns in the last ${DAYS} days (${led} led), ${rows.length} fields offered\n`);
for (const { field, used } of rows) {
  const share = turns > 0 ? (100 * used) / turns : 0;
  const bar = '#'.repeat(Math.round(share / 4));
  const note = REQUIRED.has(field) ? '  (required by the schema, so this tells you nothing)' : '';
  console.log(`  ${field.padEnd(26)} ${String(used).padStart(5)}  ${share.toFixed(1).padStart(5)}%  ${bar}${note}`);
}

const never = rows.filter((r) => r.used === 0 && !REQUIRED.has(r.field));
console.log(
  never.length === 0
    ? '\n  Every field was used at least once. There is nothing obvious to cut.\n'
    : `\n  NEVER USED in ${DAYS} days, so CANDIDATES to look into - not a list to delete:\n` +
        never.map((r) => `    ${r.field}`).join('\n') +
        '\n\n  Read why each was added before touching it, and see the notes at the\n' +
        '  top of this file on why cutting is not free.\n'
);
}
