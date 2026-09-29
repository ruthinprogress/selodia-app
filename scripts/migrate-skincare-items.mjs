// Convert the Evening Skincare Routine card into items (Ruth's item 6).
//
//   node --import ./scripts/ts-paths.mjs scripts/migrate-skincare-items.mjs        # shows the plan
//   node --import ./scripts/ts-paths.mjs scripts/migrate-skincare-items.mjs --write # applies it
//
// IT RUNS THE REAL CODE. mergeItems, archiveProse and collapseSameDay are the
// same functions the chat write path uses, so this migration is also the first
// end-to-end exercise of them. A migration that hand-writes the JSON would
// prove the JSON and nothing else - and this repository learned that lesson the
// hard way this morning, patching a food row by hand instead of fixing the
// write.
//
// NOTHING IS INVENTED. Every purpose below is her own wording, taken from the
// card's own history entry of 29 September:
//
//   "Alternating Vitamin C (Ascorbyl Glucoside) and Retinol at night to address
//    fine lines around the eyes, under-eye laxity, enlarged pores, and freckle
//    merging; Niacinamide added in the morning for skin barrier support,
//    redness/inflammation (rosacea-type redness on cheeks) and pore appearance."
//
// NOTHING IS DELETED. The old prose - "Retinol 1% nightly, vitamin C rotated
// 3-4 nights a week", which is the line that contradicted the newer one - moves
// into history rather than out of the card.

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

import { archiveProse, collapseSameDay, itemsOf, mergeItems, changeNote } from '../app/lib/me-items.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const E = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) E[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const WRITE = process.argv.includes('--write');
const TODAY = '2026-09-29';

const ITEMS = [
  {
    name: 'Niacinamide',
    when: 'AM',
    purpose: 'Skin barrier support, redness and inflammation, pore appearance',
    detail: 'Added in the morning. Rosacea-type redness on the cheeks.',
  },
  {
    name: 'Vitamin C (Ascorbyl Glucoside)',
    when: 'PM, alternating with retinol',
    purpose: 'Fine lines around the eyes, under-eye laxity, enlarged pores, freckle merging',
  },
  {
    name: 'Retinol 1%',
    when: 'PM, alternating with vitamin C',
    purpose: 'Fine lines around the eyes, under-eye laxity, enlarged pores, freckle merging',
  },
];

const supabase = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase
  .from('almanac_entries')
  .select('id, title, content')
  .eq('kind', 'me')
  .ilike('title', '%skincare%');

if (error) {
  console.error('  could not read the card:', error.message);
  process.exit(1);
}
if (!data || data.length === 0) {
  console.error('  no skincare card found');
  process.exit(1);
}
if (data.length > 1) {
  console.error(`  ${data.length} skincare cards - refusing to guess which one`);
  process.exit(1);
}

const card = data[0];
const before = card.content && typeof card.content === 'object' ? { ...card.content } : {};

const { content: archived, archived: oldProse } = archiveProse(before, TODAY);
const { items, changes } = mergeItems(itemsOf(archived), ITEMS);
const history = collapseSameDay(Array.isArray(archived.history) ? archived.history : []);

const after = { ...archived, items, history };

console.log(`\n  card: ${card.title}  (${card.id})`);
console.log(`\n  BEFORE`);
console.log(`    detail:  ${before.detail ?? '(none)'}`);
console.log(`    items:   ${itemsOf(before).length}`);
console.log(`    history: ${(Array.isArray(before.history) ? before.history : []).length} entries`);
console.log(`\n  AFTER`);
console.log(`    detail:  ${after.detail ?? '(moved to history)'}`);
console.log(`    items:   ${items.length}`);
for (const item of items) {
  console.log(`      - ${item.name}  |  ${item.when ?? '-'}  |  ${item.purpose ?? '-'}`);
}
console.log(`    history: ${history.length} entries (was ${(Array.isArray(before.history) ? before.history : []).length}; same-day bare flips collapsed)`);
console.log(`\n  archived prose: ${oldProse ?? '(none)'}`);
console.log(`  change note:    ${changeNote(changes) ?? '(none)'}`);

if (!WRITE) {
  console.log('\n  DRY RUN. Nothing written. Pass --write to apply.\n');
  process.exit(0);
}

const { error: upErr } = await supabase
  .from('almanac_entries')
  .update({ content: after, updated_at: new Date().toISOString() })
  .eq('id', card.id);

if (upErr) {
  console.error('\n  write failed:', upErr.message);
  process.exit(1);
}

const { data: back } = await supabase
  .from('almanac_entries')
  .select('content')
  .eq('id', card.id)
  .maybeSingle();

const readBack = itemsOf(back?.content);
const proseGone = !(back?.content ?? {}).detail;
const proseKept = JSON.stringify(back?.content ?? {}).includes('nightly');
console.log(`\n  written. items read back: ${readBack.length}`);
console.log(`  old prose out of the body: ${proseGone}`);
console.log(`  old prose still on the card (in history): ${proseKept}`);
process.exit(readBack.length === 3 && proseGone && proseKept ? 0 : 1);
