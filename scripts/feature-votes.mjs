// HOW MANY DIFFERENT PEOPLE HAVE ASKED FOR SOMETHING THAT IS NOT BUILT.
//
//   node scripts/feature-votes.mjs
//   node scripts/feature-votes.mjs report_photos
//
// Ruth, 30 September 2026: photo attachment in Report Builder is parked until
// after wave zero, and rather than a dead end the screen offers one button -
// "Tap here to vote for adding photos to reports."
//
// WHY IT IS A COUNT OF PEOPLE, NOT OF TAPS. At wave zero she can simply ask her
// two testers; the number only starts meaning something at wave one, with 8 to
// 12 strangers, and only if it counts PEOPLE. A unique index on (user_id,
// feature) enforces that at the write, so this script can count rows and be
// counting people.
//
// The same shape as the waitlist and cost-per-user scripts: read, print, change
// nothing.

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(import.meta.dirname, '..');
const E = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) {
    E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const only = process.argv[2] ?? null;
const supabase = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY);

let q = supabase
  .from('beta_feedback')
  .select('feature, user_id, created_at')
  .not('feature', 'is', null)
  .order('created_at', { ascending: true })
  .limit(5000);
if (only) q = q.eq('feature', only);

const { data, error } = await q;
if (error) {
  console.error('  could not read votes:', error.message);
  process.exit(1);
}

const rows = data ?? [];
if (rows.length === 0) {
  console.log(`\n  No votes yet${only ? ` for ${only}` : ''}.`);
  console.log('  That is a real answer, not a missing one: nobody has asked.\n');
  process.exit(0);
}

const byFeature = new Map();
for (const r of rows) {
  const list = byFeature.get(r.feature) ?? [];
  list.push(r);
  byFeature.set(r.feature, list);
}

console.log('');
console.log('  FEATURE VOTES - distinct people who asked');
console.log('  ' + '-'.repeat(52));
for (const [feature, list] of [...byFeature].sort((a, b) => b[1].length - a[1].length)) {
  const people = new Set(list.map((r) => r.user_id)).size;
  const first = String(list[0].created_at).slice(0, 10);
  const last = String(list[list.length - 1].created_at).slice(0, 10);
  console.log(`  ${feature.padEnd(24)} ${String(people).padStart(4)} ${people === 1 ? 'person' : 'people'}`);
  console.log(`  ${''.padEnd(24)}      first ${first}, latest ${last}`);
}
console.log('');
console.log('  A tap is one person asking once. It is not a promise to build it,');
console.log('  and at wave zero two testers can simply be asked instead.');
console.log('');
