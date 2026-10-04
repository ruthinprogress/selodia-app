// WHEN SHE NAMES A MEAL, DOES THAT MEAL GO?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-delete-the-named-one.mjs
//
// Ruth, 4 October 2026: "I asked her to delete Saturday's fish and chips, she
// didn't. She said she did."
//
// She was right twice over. The correction lookup found its row with
//
//     .order(happened_at, { ascending: false }).limit(1)
//
// - the most recent entry in the window, with no reference whatsoever to what she
// had named. For "delete that last one", which is what the machinery was built
// for, that is exactly right. For "Saturday's fish and chips" it removes
// whichever meal happened to be logged last that day, and the app then states a
// deletion that really did happen - of something she never asked about. Her fish
// and chips were still in the log afterwards; something else was not.
//
// A DELETE THAT HITS THE WRONG ROW AND REPORTS SUCCESS is the worst shape a bug
// in this app can take: the data is gone, the record of what went is gone with
// it, and the reply says it went to plan.
//
// The matching is the duplicate guard's own comparison - grammar dropped, order
// ignored - so "fish and chips" finds "Dinner - fish and chips and mushy peas"
// and does not find a salad just because both contain "and".

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { contentWords } = await import(root + '/app/lib/food-dedupe.ts');

let pass = 0;
const failures = [];
function check(name, fn) {
  try {
    const note = fn();
    console.log(`  PASS  ${name}${note ? `   ${note}` : ''}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL  ${name}\n          ${e.message}`);
    failures.push(name);
  }
}

// Her Saturday, exactly as food_logs held it when she asked.
const SATURDAY = [
  { id: 'pub', raw_text: 'Pub - an Aperol spritz, a lager shandy, a mini lemon cupcake', meal_label: 'Pub' },
  { id: 'dinner', raw_text: 'Dinner - fish and chips and mushy peas', meal_label: 'Dinner' },
  { id: 'breakfast', raw_text: 'Breakfast - two black coffees, cheesy omelette', meal_label: 'Breakfast' },
];

/** The rule as the route applies it: every content word she used must be present. */
function matches(rows, named) {
  const wanted = contentWords(named);
  return rows.filter((r) => {
    const have = contentWords([r.raw_text, r.meal_label].filter(Boolean).join(' '));
    return wanted.size > 0 && [...wanted].every((w) => have.has(w));
  });
}

console.log('\n  THE ONE SHE NAMED IS THE ONE THAT GOES\n');

check('"fish and chips" finds the fish and chips', () => {
  const hits = matches(SATURDAY, 'fish and chips');
  assert.strictEqual(hits.length, 1, `${hits.length} rows matched`);
  assert.strictEqual(hits[0].id, 'dinner', `it matched ${hits[0].id}`);
  return 'Dinner - fish and chips and mushy peas';
});

check('it does not match a different meal on the same day', () => {
  // The failure she actually saw: something else was removed and reported as
  // done. Order in the list must never decide this.
  for (const named of ['fish and chips', 'the flapjack', 'aperol spritz']) {
    const hits = matches(SATURDAY, named);
    assert.ok(hits.length <= 1, `"${named}" matched ${hits.length} rows`);
  }
  assert.strictEqual(matches(SATURDAY, 'the flapjack').length, 0, 'a flapjack was found on a day with none');
  return 'no stray matches across three meals';
});

check('grammar does not make a match', () => {
  // "fish and chips" and a salad both contain "and". The function words are
  // dropped before comparing, so the overlap has to be real food.
  const salad = [{ id: 's', raw_text: 'Lunch - chicken and salad and dressing', meal_label: 'Lunch' }];
  assert.strictEqual(matches(salad, 'fish and chips').length, 0, 'a salad matched fish and chips');
  return '"and" is not evidence';
});

check('her words do not have to be the whole entry', () => {
  // She says "fish and chips"; the row says "Dinner - fish and chips and mushy
  // peas". A whole-string comparison would find nothing, which is how this ends
  // up falling back to the newest row again.
  assert.strictEqual(matches(SATURDAY, 'fish').length, 1);
  assert.strictEqual(matches(SATURDAY, 'mushy peas').length, 1);
  assert.strictEqual(matches(SATURDAY, 'coffees').length, 1);
  return 'part of the entry is enough';
});

check('naming something that is not there matches nothing', () => {
  // AND THAT MUST NOT FALL BACK TO DELETING THE NEWEST ROW. A mis-heard word
  // becoming a lost dinner is the whole fault, one step along.
  assert.strictEqual(matches(SATURDAY, 'lasagne').length, 0);
  assert.strictEqual(matches(SATURDAY, 'porridge').length, 0);
  return 'nothing matched, nothing to remove';
});

// ---- the route's own wiring ----------------------------------------------
check('the lookup no longer takes whatever was logged last', () => {
  const src = readFileSync('app/api/ask-selodia/route.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.ok(
    !/\.order\(timeCol, \{ ascending: false \}\)\s*\.limit\(1\)/.test(src),
    'the correction still takes the single most recent row, so a named meal ' +
      'deletes whatever happened to be logged last'
  );
  assert.ok(/correctionMatch/.test(src), 'the model has no way to say WHICH thing she named');
  assert.ok(
    /contentWords\(named\)/.test(src),
    'the named words are never compared against the entries'
  );
  return 'named, then matched';
});

check('no match means nothing is removed, and she is told why', () => {
  const src = readFileSync('app/api/ask-selodia/route.ts', 'utf8');
  assert.ok(
    /Nothing matching/.test(src),
    'a named thing that is not found falls back to the generic "nothing recent to ' +
      'change", which does not tell her that her words did not match'
  );
  assert.ok(
    /more than one thing there that matches/.test(src),
    'two different matching entries are resolved by guessing rather than by asking'
  );
  return 'not found and ambiguous say different things';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
