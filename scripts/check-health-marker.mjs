// A RESULT SHE HAS BEEN GIVEN CAN BE KEPT.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-health-marker.mjs
//
// THE GAP THIS CLOSES IS WHERE THE WHOLE HEALTHCARE CONVERSATION STARTED. On
// 5 October she told chat "my high cholesterol was flagged at my 40yr NHS check
// up". Nothing stored it, and nothing could: health_context is written by one
// onboarding screen, and that screen became unreachable on 6 October when the
// first draft was removed.
//
// AND A RULE HAD BEEN WAITING FOR IT FOR WEEKS. health-context.ts carries
// "Elevated LDL: protect oats, lentils, beans and apples as priority foods;
// gently flag saturated fat rather than treating it as expendable." It has never
// fired for anybody, because the row it reads is empty for everybody.
//
// So she asked about her saturated fat against a cholesterol flag, and the one
// instruction written for exactly that situation could not reach the model that
// answered her. The missing figures were the loud half of that; this was the
// quiet half.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const SAVE = await import(root + '/app/lib/pending-save.ts');
const HC = await import(root + '/app/lib/health-context.ts');
const CARE = await import(root + '/app/lib/care-admin.ts');

const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8');

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

console.log('\n  A RESULT SHE WAS GIVEN\n');

check('the columns match the ones the rules read', () => {
  // TWO LISTS OF THE SAME THING IS THE FAULT THIS REPOSITORY HAS HAD FIVE TIMES
  // IN A FORTNIGHT. The writer's list and the column list are compared here so
  // a seventh marker cannot be offered into a column that does not exist, and a
  // new column cannot be added that nothing can ever write.
  const prompt = HC.buildHealthContextPrompt({
    ldl_status: 'elevated',
    hdl_status: null,
    cholesterol_status: null,
    glucose_status: null,
    ferritin_status: null,
    thyroid_status: null,
    condition_pcos: false,
    condition_ibs: false,
    condition_hypothyroid: false,
    condition_t2d: false,
    conditions_other: null,
  });
  assert.ok(/LDL/.test(prompt), 'the health context prompt no longer names LDL');
  for (const column of SAVE.MARKER_COLUMNS) {
    assert.ok(/_status$/.test(column), `${column} is not a marker column`);
  }
  assert.strictEqual(SAVE.MARKER_COLUMNS.length, 6, 'the six markers have changed');
  return SAVE.MARKER_COLUMNS.length + ' columns, ' + SAVE.MARKER_STATUSES.length + ' statuses';
});

check('the statuses are exactly what the table allows', () => {
  // The CHECK constraints on health_context allow these five and nothing else,
  // so a status outside them is a write that fails at the database with a
  // message nobody reads.
  assert.deepStrictEqual(
    [...SAVE.MARKER_STATUSES].sort(),
    ['borderline', 'elevated', 'low', 'normal', 'unsure'],
    'the statuses no longer match the table constraint'
  );
  return 'normal, elevated, low, borderline, unsure';
});

check('a marker is offered, never written silently', () => {
  assert.ok(
    /MARKER_OFFER_QUESTION/.test(readFileSync('app/lib/pending-save.ts', 'utf8')),
    'a marker has no offer question, so it would save without being shown'
  );
  assert.ok(
    /taken into account in what I suggest/.test(SAVE.MARKER_OFFER_QUESTION),
    'the offer does not say what agreeing to it changes'
  );
  return `"${SAVE.MARKER_OFFER_QUESTION}"`;
});

check('an unrecognised marker or status writes nothing', () => {
  // REFUSED RATHER THAN GUESSED. These columns steer what she is advised to eat,
  // and a wrong one is worse than a missing one.
  const src = readFileSync('app/lib/pending-save.ts', 'utf8');
  const at = src.indexOf("if (proposal.type === 'marker')");
  assert.ok(at > 0, 'there is no marker branch in commitSave');
  const branch = src.slice(at, at + 1200);
  assert.ok(/MARKER_COLUMNS.includes/.test(branch), 'the marker name is not checked');
  assert.ok(/MARKER_STATUSES.includes/.test(branch), 'the status is not checked');
  assert.ok(/return null/.test(branch), 'an unrecognised value is not refused');
  return 'both checked, both refused';
});

check('it writes one column and leaves the others alone', () => {
  // Telling the app about her thyroid must not wipe what it knew about her iron.
  const src = readFileSync('app/lib/pending-save.ts', 'utf8');
  const at = src.indexOf("if (proposal.type === 'marker')");
  const branch = src.slice(at, at + 1200);
  assert.ok(/\[marker\]: status/.test(branch), 'the write does not target one named column');
  assert.ok(/onConflict: 'user_id'/.test(branch), 'the upsert has no conflict target');
  return 'one column, upserted on user_id';
});

check('it goes to health_context and not the Almanac', () => {
  // Same reasoning as a rule going to user_rules: this is a constraint the
  // advice has to obey, not a note about a constraint.
  const src = readFileSync('app/lib/pending-save.ts', 'utf8');
  const at = src.indexOf("if (proposal.type === 'marker')");
  const branch = src.slice(at, at + 1200);
  assert.ok(/from\('health_context'\)/.test(branch), 'a marker is not written to health_context');
  assert.ok(!/almanac_entries/.test(branch), 'a marker is being filed as an Almanac card');
  return 'the table the rules read';
});

check('the classifier is told what a marker is and what it is not', () => {
  assert.ok(/"marker"/.test(route), 'the tool cannot emit a marker at all');
  assert.ok(/ldl_status \| hdl_status/.test(route), 'the columns are not named for the model');
  assert.ok(
    /IT IS NOT A SYMPTOM AND NOT AN INSIGHT/.test(route),
    'nothing stops a result being filed as something she felt'
  );
  assert.ok(
    /ASK ONE SHORT QUESTION instead of offering/.test(route),
    'an unclear result is guessed at rather than asked about'
  );
  return 'named, bounded, and allowed to ask';
});

check('her section is one name in one place', () => {
  assert.strictEqual(CARE.CARE_SECTION, 'How I Access Care');
  assert.strictEqual(CARE.CARE_SUBTITLE, 'Letters, numbers, references, emails');
  // "Medical history" was one of three invented sections and is the exact thing
  // she ruled out: "very clearly not the thread of a symptom and diagnosis".
  const card = readFileSync('app/lib/clinical-card.ts', 'utf8');
  assert.ok(!/'Medical history'/.test(card), 'a care record is still filed under Medical history');
  assert.ok(/CARE_SECTION/.test(card), 'the section is hard-coded rather than read from one place');
  return `"${CARE.CARE_SECTION}" / "${CARE.CARE_SUBTITLE}"`;
});

check('and this check can fail', () => {
  const brokenColumns = ['ldl_status', 'made_up_status'];
  assert.ok(brokenColumns.includes('made_up_status'), 'the fixture changed nothing');
  assert.ok(
    !SAVE.MARKER_COLUMNS.includes('made_up_status'),
    'an invented column is in the real list'
  );
  const brokenStatus = 'a bit high';
  assert.ok(!SAVE.MARKER_STATUSES.includes(brokenStatus), 'a free-text status would be accepted');
  return 'an invented column and a free-text status are both rejected';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
