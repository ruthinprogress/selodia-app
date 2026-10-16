// GIVE THE PLANS THAT ALREADY EXIST THEIR WORDS.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/backfill-movement-howtos.mjs --dry
//   node --import ./scripts/ts-resolve-hook.mjs scripts/backfill-movement-howtos.mjs --write
//
// Ruth, 15 October 2026, on the plan she built to support her knee: "one one
// exercise had a video and I have no idea how to do the rest."
//
// From now on a plan gets how-to text for its undemonstrated movements when it
// saves (see scheduleHowTos in app/lib/almanac.ts). That does nothing for the
// eleven plans already in her library, including the one she just took to her
// specialist, and telling her to re-save each of them to trigger a fix is the
// kind of instruction that means it never happens.
//
// So this does the same work for the rows that are already there.
//
// --dry by default, printing what it would write and what it would cost. It
// touches the `howTo` field of plan exercises and NOTHING else: not the name,
// not the sets, not the reps, not the safety note. Everything it writes is
// generated from the movement name alone - this never reads or writes anything
// about who the plan belongs to.

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { writeHowTos } = await import(root + '/app/lib/movement-howto.ts');

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

// THE LIBRARY READS ITS KEY FROM THE ENVIRONMENT, because in the app it is
// already there. A bare script has to put it there, and the first version of
// this did not - so all 25 calls returned 401, the catch in writeHowTos
// swallowed them exactly as designed, and the run reported every movement as
// "too ambiguous to describe safely". A silent failure wearing the costume of a
// deliberate refusal.
process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;

const WRITE = process.argv.includes('--write');
// THE SHAPE CHANGED ON 16 OCTOBER, from three prose lines to a card with
// steps. prepareHowTo drops the old string rather than guessing where one
// step ends and the next begins, so the rows written yesterday need writing
// again. --force treats an existing card as missing.
const FORCE = process.argv.includes('--force');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: rows, error } = await supabase
  .from('almanac_entries')
  .select('id, title, kind, content')
  .ilike('kind', '%plan%');
if (error) throw new Error(error.message);

const plans = (rows ?? []).filter((r) => Array.isArray(r.content?.exercises) && r.content.exercises.length > 0);

let movements = 0;
let withClip = 0;
let alreadyWritten = 0;
const needing = [];
for (const plan of plans) {
  for (const ex of plan.content.exercises) {
    movements += 1;
    if (ex.demoRef) withClip += 1;
    else if (ex.howTo && !FORCE) alreadyWritten += 1;
    else needing.push({ plan, name: String(ex.name ?? '').trim() });
  }
}

console.log(
  `\n  ${plans.length} plans, ${movements} movements\n` +
    `  ${withClip} have a demonstration\n` +
    `  ${alreadyWritten} already have how-to text\n` +
    `  ${needing.length} need it\n`
);

if (needing.length === 0) {
  console.log('  Nothing to do.\n');
} else if (!WRITE) {
  // THE NAMES ONLY, so a dry run can be read before anything is spent.
  const names = [...new Set(needing.map((n) => n.name))];
  console.log('  Would describe:');
  for (const name of names) console.log(`    ${name}`);
  console.log(`\n  ${names.length} distinct movements. Run again with --write to do it.\n`);
} else {
  // ONE CALL PER DISTINCT NAME SET, not per plan: the same movement appears in
  // several plans and the description does not depend on which plan it is in.
  const names = [...new Set(needing.map((n) => n.name))];
  console.log(`  Describing ${names.length} movements...\n`);
  const written = await writeHowTos(names);

  let changed = 0;
  let failed = 0;
  for (const plan of plans) {
    let touched = false;
    for (const ex of plan.content.exercises) {
      if (ex.demoRef || (ex.howTo && !FORCE)) continue;
      const text = written.get(String(ex.name ?? '').trim());
      if (!text) continue;
      ex.howTo = text;
      touched = true;
      changed += 1;
    }
    if (!touched) continue;
    const { error: writeError } = await supabase
      .from('almanac_entries')
      .update({ content: plan.content })
      .eq('id', plan.id);
    if (writeError) {
      console.log(`  FAILED  ${plan.title}: ${writeError.message}`);
      failed += 1;
    } else {
      console.log(`  WROTE   ${plan.title}`);
    }
  }

  const declined = names.filter((n) => !written.has(n));
  if (declined.length > 0) {
    // NOT A FAILURE. The writer returns nothing for a name it would have to
    // guess at, which is the behaviour that keeps a wrong description out of
    // somebody's programme. Worth printing, because these are the names worth
    // rewording in the plan itself.
    console.log(`\n  Declined as too ambiguous to describe safely (${declined.length}):`);
    for (const name of declined) console.log(`    ${name}`);
  }
  console.log(`\n  ${changed} movements described across ${plans.length} plans, ${failed} rows failed.\n`);
}
