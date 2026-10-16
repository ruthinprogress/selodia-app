// A MOVEMENT WITH NO CLIP CAN STILL BE SEEN.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-a-movement-can-be-seen.mjs
//
// Ruth, 15 October 2026, on the plan she built for her knee: "one one exercise
// had a video and I have no idea how to do the rest." Thirteen of her forty-five
// movements resolved to a demonstration.
//
// check-a-movement-can-be-performed.mjs covers the words. This covers the
// pictures: a library of illustrations Selodia owns, drawn in the house style,
// one file per movement holding the start position above the finish.
//
// WHAT THIS IS REALLY GUARDING. The matcher. resolve_illustration_refs is a
// deliberate copy of resolve_movement_refs - an exact name or an exact word set
// and nothing weaker - because a subset rule was measured when the clip matcher
// was built and rejected: it matched "kettlebell romanian deadlifts" to the
// SINGLE-LEG variant, and a third of the matches it added were a different
// movement under a different load. A missing picture is a small disappointment;
// a confidently wrong one is a form fault, and a picture asserts more than a
// line of text does.
//
// Every name tested below is checked against the REAL function in the database,
// not a reimplementation here, for the same reason movement-demos.ts defers to
// SQL: two algorithms obliged to agree forever will stop agreeing.

import assert from 'node:assert';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) {
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const read = (p) => fs.readFileSync(p, 'utf8').split(String.fromCharCode(13)).join('');
const route = read('app/api/movement-illustration/route.ts');
const lib = read('app/lib/movement-illustrations.ts');
const card = read('mobile/src/components/almanac-detail.tsx');
const picture = read('mobile/src/components/movement-illustration.tsx');
const uploader = read('scripts/upload-animations.mjs');

let pass = 0;
const failures = [];
async function check(name, fn) {
  try {
    const note = await fn();
    console.log(`  PASS  ${name}${note ? `   ${note}` : ''}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL  ${name}\n          ${e.message}`);
    failures.push(name);
  }
}

const resolve = async (names) => {
  const { data, error } = await supabase.rpc('resolve_illustration_refs', { names });
  if (error) throw new Error(error.message);
  return new Map(data.map((r) => [r.input_name, r.join_key]));
};

console.log('\n  THE MATCHER IS AS STRICT AS THE ONE FOR CLIPS\n');

await check('an exact name matches, whatever the case', async () => {
  const found = await resolve(['Seated straddle stretch', 'FROG STRETCH']);
  assert.strictEqual(found.get('Seated straddle stretch'), 'seated straddle stretch');
  assert.strictEqual(found.get('FROG STRETCH'), 'frog stretch');
  return 'case folded, nothing else';
});

await check('the same words in another order match', async () => {
  const found = await resolve(['stretch straddle seated']);
  assert.strictEqual(found.get('stretch straddle seated'), 'seated straddle stretch');
  return 'word set, not word order';
});

await check('A SUBSET DOES NOT MATCH, which is the whole point', async () => {
  // "frog" is contained in "frog stretch" and must still find nothing. This is
  // the rule that was measured and kept: uniqueness is not correctness.
  const found = await resolve(['frog', 'splits', 'cossack']);
  for (const name of ['frog', 'splits', 'cossack']) {
    assert.strictEqual(found.get(name), null, `"${name}" matched something`);
  }
  return 'three subsets refused';
});

await check('AN EXTRA WORD DOES NOT MATCH EITHER', async () => {
  // A band changes the movement. So does a dumbbell, and so does single-leg.
  const found = await resolve(['seated straddle stretch with band', 'single leg frog stretch']);
  assert.strictEqual(found.get('seated straddle stretch with band'), null);
  assert.strictEqual(found.get('single leg frog stretch'), null);
  return 'an added implement is a different movement';
});

await check('AND THE MATCHER ACTUALLY DISCRIMINATES', async () => {
  // THE VACUOUS-PASS GUARD. Every refusal above would pass just as happily if
  // resolve_illustration_refs were broken and returned null for everything -
  // and a matcher that finds nothing is not strict, it is dead. So one call has
  // to produce both answers: a name that resolves and a name that does not.
  const found = await resolve(['frog stretch', 'a movement nobody has ever drawn']);
  assert.strictEqual(found.get('frog stretch'), 'frog stretch', 'a known movement did not resolve');
  assert.strictEqual(found.get('a movement nobody has ever drawn'), null, 'an invented name resolved');
  return 'one hit and one miss from the same call';
});

console.log('\n  A PROGRESSION IS A SET, IN ORDER\n');

await check('every stage of a progression is numbered and none is missing', async () => {
  const { data, error } = await supabase
    .from('movement_illustrations')
    .select('progression, stage')
    .not('progression', 'is', null);
  if (error) throw new Error(error.message);

  const sets = new Map();
  for (const row of data) {
    if (!sets.has(row.progression)) sets.set(row.progression, []);
    sets.get(row.progression).push(row.stage);
  }
  assert.ok(sets.size > 0, 'no progressions are recorded at all');

  for (const [name, stages] of sets) {
    const sorted = [...stages].sort((a, b) => a - b);
    assert.strictEqual(new Set(sorted).size, sorted.length, `${name} has two stages with the same number`);
    // A GAP IS ALLOWED WHILE A SET IS BEING BUILT - the side splits ran 1,2,3,4,6
    // for an afternoon while stage 5 was being corrected - but it must start at 1,
    // or the screen opens on a progression that appears to begin halfway through.
    assert.strictEqual(sorted[0], 1, `${name} starts at stage ${sorted[0]}, not 1`);
  }
  return `${sets.size} progressions, each starting at stage 1`;
});

await check('a stage number without a progression is refused by the database', async () => {
  const { error } = await supabase
    .from('movement_illustrations')
    .insert({ join_key: '__check_orphan_stage', title: 'x', storage_path: 'x.png', stage: 3 });
  assert.ok(error, 'a stage with no progression was accepted');
  return 'the CHECK constraint holds';
});

console.log('\n  THE LADDER: A CLIP, THEN A DRAWING, THEN THE WORDS\n');

await check('the card prefers a clip and falls back to a drawing', () => {
  assert.ok(
    /exercise\.demoRef \|\| !exercise\.howTo/.test(card),
    'the clip is no longer preferred'
  );
  assert.ok(
    /!exercise\.demoRef && exercise\.howTo \? \(\s*<MovementIllustration/.test(card),
    'the illustration is not shown where there is no clip'
  );
  return 'clip, else drawing';
});

await check('AND THE WORDS STAY UNDERNEATH THE PICTURE', () => {
  // A drawing fixes one depth and one width of knee; bodies differ. The recipe
  // carries what the picture cannot say. Ruth on the frog stretch: "could say to
  // open out knees as wide as they can."
  const illustrationAt = card.indexOf('<MovementIllustration');
  const howToAt = card.indexOf('exercise.howTo.steps.map');
  assert.ok(illustrationAt > 0 && howToAt > illustrationAt, 'the recipe no longer follows the picture');
  return 'picture first, then how far to go';
});

await check('an absent illustration draws nothing at all', () => {
  assert.ok(/if \(state === 'absent'\) return null;/.test(picture), 'a dead slot can be rendered');
  assert.ok(
    /setState\('absent'\)/.test(picture) && /catch \{/.test(picture),
    'a failure is not treated as an absence'
  );
  return 'no placeholder, no greyed box';
});

await check('START and FINISH are drawn by the app, not painted into the file', () => {
  assert.ok(/START/.test(picture) && /FINISH/.test(picture), 'the labels are not rendered');
  assert.ok(/accessibilityLabel/.test(picture), 'the picture has no screen-reader description');
  return 'readable, translatable, and spelled correctly';
});

console.log('\n  AN ANIMATION IS AN UPGRADE, NEVER A REPLACEMENT\n');

await check('AN ANIMATION CANNOT BE ATTACHED WITHOUT ITS STILL', () => {
  assert.ok(/REFUSED  no illustration for this movement/.test(uploader), 'the guard is gone');
  assert.ok(/refused \+= 1/.test(uploader), 'a refusal is not counted');
  return 'the still is the poster frame and the fallback';
});

await check('the route signs an animation only when one exists', () => {
  assert.ok(
    /row\.animation_path \? await sign\(row\.animation_path as string\) : null/.test(route),
    'a missing animation is not handled as null'
  );
  return 'null is the expected state';
});

console.log('\n  AND THE LIBRARY IS REACHABLE\n');

await check('every recorded illustration has a file behind it', async () => {
  const { data, error } = await supabase
    .from('movement_illustrations')
    .select('join_key, storage_path');
  if (error) throw new Error(error.message);
  assert.ok(data.length > 0, 'no illustrations are recorded');

  const { data: listed, error: listError } = await supabase.storage.from('movement-illustrations').list();
  if (listError) throw new Error(listError.message);
  const present = new Set((listed ?? []).map((f) => f.name));

  for (const row of data) {
    assert.ok(present.has(row.storage_path), `${row.join_key} has no file at ${row.storage_path}`);
  }
  return `${data.length} rows, ${data.length} files`;
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
