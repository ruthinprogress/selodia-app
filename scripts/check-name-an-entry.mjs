// NAMING AN ENTRY FINDS IT, WHATEVER KIND IT IS.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-name-an-entry.mjs
//
// Ruth, 9 October 2026, using the duplicate removal she had just asked for:
// "the yoga went in five times. Can you take the duplicates out?"
//
// The answer, verbatim: "Clearing out the duplicate yoga entries, keeping just
// the one. / Nothing matching \"yoga\" was found on that day, so nothing was
// removed." Five yoga rows were on that day. All five are still there.
//
// THE CAUSE WAS ONE LINE READING TWO FOOD COLUMNS FOR EVERY KIND:
//
//     const text = [r.raw_text, r.meal_label] ... .join(' ')
//
// activity_logs has neither; it has raw_input and activity_type.
// body_measurements and personal_metrics have neither either. So the text being
// searched was the empty string, every word she said failed to appear in it,
// and the answer was always "nothing matching". Not intermittently - ALWAYS,
// for every named correction of anything that is not food, for as long as the
// feature has existed.
//
// WHY A CHECK AND NOT A CAREFUL READ. The broken line is correct code about the
// wrong table. It type-checks, it runs, it returns a clean answer, and the
// answer it returns is the same one a genuinely absent entry produces. Nothing
// about reading it looks wrong. Only running it against a real activity row
// does.

import assert from 'node:assert';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { matchableText, MATCH_COLUMNS_FOR, TABLE_FOR } = await import(
  root + '/app/lib/log-correction.ts'
);

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

// Her five real rows, copied from activity_logs.
const YOGA = {
  activity_type: 'yoga',
  duration_min: 60,
  raw_input: 'a 60 minute yoga class',
  happened_at: '2026-10-09T09:41:40.058Z',
};

// Real shapes for the other three, by column name from information_schema.
const ROWS = {
  food: { raw_text: 'half a smoked salmon sandwich on wholemeal bread', meal_label: 'Lunch' },
  activity: YOGA,
  measurement: { raw_input: '55.2 this morning', notes: 'morning weight' },
  personal_metric: { metric_name: 'waist', raw_input: 'my waist is 78cm' },
};

// The word-splitting the route uses, reproduced so this check does not depend
// on importing a route.
const words = (s) =>
  new Set(
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((w) => w.length > 2)
  );

const finds = (kind, said) => {
  const have = words(matchableText(kind, ROWS[kind]));
  const wanted = words(said);
  return wanted.size > 0 && [...wanted].every((w) => have.has(w));
};

console.log('\n  NAMING AN ENTRY FINDS IT\n');

check('"yoga" finds the yoga', () => {
  assert.ok(finds('activity', 'yoga'), `matchableText gave: ${matchableText('activity', YOGA)}`);
  return `activity text is "${matchableText('activity', YOGA)}"`;
});

check('and this check can fail', () => {
  // The old line, exactly as it was, against the same row.
  const asShipped = (r) => [r.raw_text, r.meal_label].filter((v) => typeof v === 'string').join(' ');
  assert.strictEqual(asShipped(YOGA), '', 'the old line is not being reproduced');
  const have = words(asShipped(YOGA));
  assert.strictEqual(have.size, 0, 'the old line somehow found words on an activity row');
  assert.ok(![...words('yoga')].every((w) => have.has(w)), 'the old line matched, which it cannot');
  // And the new one must not match something she did not say.
  assert.ok(!finds('activity', 'running'), 'the new text matches a word that is not in the row');
  return 'the old line gives "" and cannot match; the new one refuses "running"';
});

check('every kind has columns that exist on its own table', () => {
  // The fault was a column name from one table used against four, so the thing
  // worth asserting is that each kind names its OWN columns. These lists are
  // from information_schema on 9 October 2026.
  const REAL = {
    food_logs: ['created_at', 'happened_at', 'raw_text', 'meal_label', 'kcal', 'protein_g', 'notes', 'id', 'user_id'],
    activity_logs: ['created_at', 'happened_at', 'activity_type', 'duration_min', 'kcal_burned', 'source', 'raw_input', 'notes', 'id', 'user_id'],
    body_measurements: ['created_at', 'weight_kg', 'body_fat_pct', 'muscle_kg', 'raw_input', 'notes', 'id', 'measured_at', 'user_id'],
    personal_metrics: ['id', 'user_id', 'measured_at', 'metric_name', 'value', 'unit', 'raw_input', 'created_at'],
  };
  for (const [kind, cols] of Object.entries(MATCH_COLUMNS_FOR)) {
    const table = TABLE_FOR[kind];
    const real = REAL[table];
    assert.ok(real, `no column list recorded for ${table}`);
    for (const col of cols) {
      assert.ok(real.includes(col), `${kind} matches on "${col}", which ${table} does not have`);
    }
  }
  return `${Object.keys(MATCH_COLUMNS_FOR).length} kinds, every column present on its own table`;
});

check('each kind can be found by a word a person would use', () => {
  for (const [kind, said] of [
    ['food', 'sandwich'],
    ['activity', 'yoga'],
    ['measurement', 'morning'],
    ['personal_metric', 'waist'],
  ]) {
    assert.ok(finds(kind, said), `"${said}" does not find the ${kind} row`);
  }
  return 'sandwich, yoga, morning, waist';
});

check('a number in the row is matchable, because she uses numbers to separate entries', () => {
  // "the 60 minute yoga" is how a person distinguishes two yoga entries, and
  // duration_min is a number column.
  assert.ok(matchableText('activity', YOGA).includes('60'), 'duration is not in the matchable text');
  assert.ok(finds('activity', '60 minute yoga'), '"60 minute yoga" does not find it');
  return '"60 minute yoga" finds it';
});

check('every word has to be present, so a near miss is not a hit', () => {
  // The rule the route relies on: a mis-heard word must not delete the wrong
  // entry. "pilates" shares nothing with this row and must find nothing.
  assert.ok(!finds('activity', 'pilates'), 'pilates matched a yoga row');
  assert.ok(!finds('activity', 'yoga pilates'), 'a half-match counted as a match');
  assert.ok(!finds('food', 'sandwich cheese'), 'a half-match counted as a match on food');
  return 'pilates, yoga pilates and sandwich cheese all refused';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
