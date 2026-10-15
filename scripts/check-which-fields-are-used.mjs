// COUNT THE TOOL'S FIELDS BEFORE CUTTING ANY OF THEM.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-which-fields-are-used.mjs
//
// Ruth, 15 October 2026: "yes, add the instrumentation now."
//
// WHAT IT IS FOR. The deciding call of a led turn produces 327 to 1,401 output
// tokens, and output tokens are where the seconds of a 13.6s turn are. The tool
// it fills has grown to around thirty optional fields, and the obvious saving
// is to stop offering the ones nobody uses.
//
// Nobody can name those fields. They have never been counted. Guessing is how a
// working feature gets deleted, because half of them exist BECAUSE something
// went wrong once - which is exactly the kind of field that fires rarely and
// matters enormously on the turn it fires.
//
// WHAT THIS FILE GUARDS is the promise that makes the instrument acceptable at
// all: NAMES ONLY. Not what she logged, not what she said, not which distress
// tier the turn drew. One question only - which of the tool's fields are ever
// used - and the rest of her turn stays where it already lives.
//
// And one correctness property that is easy to get wrong and would quietly
// ruin the data: a field is "set" when the MODEL chose to say something, before
// the app's own overrides further down the route rewrite it.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { fieldsSet } = await import(root + '/app/lib/turn-diagnostics.ts');

const read = (path) => readFileSync(path, 'utf8').split(String.fromCharCode(13)).join('');
const route = read('app/api/ask-selodia/route.ts');
const diagnostics = read('app/lib/turn-diagnostics.ts');

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

console.log('\n  WHICH FIELDS ARE USED\n');

check('a field is set when the model said something', () => {
  const got = fieldsSet({
    classification: 'neutral',
    reply: 'Noted.',
    logIntent: 'food',
    proposedSave: { type: 'care', title: 'Knee claim' },
    feelingMood: 4,
  });
  assert.deepStrictEqual(got, ['classification', 'feelingMood', 'logIntent', 'proposedSave', 'reply']);
  return 'five fields, sorted';
});

check('and NOT set when the model declined', () => {
  // The whole measurement turns on this. Count a declined field as used and
  // every field looks used, which is the one answer that would stop the cut
  // ever happening.
  const got = fieldsSet({
    classification: 'neutral',
    reply: 'Noted.',
    logIntent: 'none',
    correctionKind: '',
    draftRequest: null,
    patternTrigger: undefined,
    suggestsFood: false,
    endVoiceSession: false,
  });
  assert.deepStrictEqual(got, ['classification', 'reply']);
  return "'none', '', null, undefined and false all read as declined";
});

check('a zero is a value, not a decline', () => {
  // Easy to lose with a truthiness filter, and it would silently delete every
  // reading of zero this app can take.
  const got = fieldsSet({ classification: 'neutral', reply: 'ok', feelingMood: 0, statedGoalWeightKg: 0 });
  assert.ok(got.includes('feelingMood'), 'a mood of zero was counted as unset');
  assert.ok(got.includes('statedGoalWeightKg'), 'a goal of zero was counted as unset');
  return 'zero survives';
});

console.log('\n  AND IT RECORDS NAMES, NOTHING ELSE\n');

check('THE ROW CARRIES NO VALUES', () => {
  // The promise. Everything else here is detail.
  const body = diagnostics.slice(diagnostics.indexOf('export function recordDecisionFields'));
  const written = body.slice(body.indexOf('write({'), body.indexOf('}\n\n', body.indexOf('write({')));
  assert.ok(/detail: \{ set: d\.fields, count: d\.fields\.length \}/.test(written), 'the detail is not names and a count');
  for (const leak of ['result', 'message', 'classification:', 'summary', 'reply:']) {
    assert.ok(!written.includes(leak), `the recorded row carries ${leak}`);
  }
  return 'names and a count, and that is all';
});

check('the classification is deliberately not in it', () => {
  // A distress tier is a fact about a person on a day. It is already recorded
  // where it belongs, and this instrument has no business holding a second
  // copy to answer a question about token counts.
  const body = diagnostics.slice(diagnostics.indexOf('export function recordDecisionFields'));
  const signature = body.slice(0, body.indexOf('): void'));
  assert.ok(!/classification/.test(signature), 'the recorder takes a classification');
  return 'it is not even passed in';
});

check('names only is written down, not just done', () => {
  assert.ok(
    /NAMES ONLY, AND THAT IS THE WHOLE PROMISE/.test(diagnostics),
    'nothing says why this is allowed to exist'
  );
  return 'the reason survives the next edit';
});

console.log('\n  AND IT MEASURES THE MODEL, NOT THE APP\n');

check('RECORDED BEFORE THE APP OVERRIDES ANYTHING', () => {
  // The route corrects the model in several places. Record after those and the
  // table reports the app's decisions as the model's, which is the one way
  // this data could be wrong without looking wrong.
  const recorded = route.indexOf('recordDecisionFields({');
  assert.ok(recorded > 0, 'the fields are never recorded');
  for (const [what, marker] of [
    ['the photo-only verdict', 'if (isPhotoOnly) photoOnlyVerdict(result);'],
    ['a bare yes to a waiting offer', "result.saveAnswer = 'yes';"],
  ]) {
    const override = route.indexOf(marker);
    assert.ok(override > 0, `could not find ${what}`);
    assert.ok(recorded < override, `recorded after ${what} rewrote the result`);
  }
  return 'ahead of the photo verdict and the bare yes';
});

check('and after the result exists, which is not nothing', () => {
  const parsed = route.indexOf('const result = toolUse.input as {');
  const recorded = route.indexOf('recordDecisionFields({');
  assert.ok(parsed > 0 && parsed < recorded, 'the fields are recorded before the result is parsed');
  return 'between the parse and the first override';
});

check('it is fire and forget, so a latency measurement adds none', () => {
  const recorded = route.indexOf('recordDecisionFields({');
  const before = route.slice(Math.max(0, recorded - 40), recorded);
  assert.ok(!/await\s*$/.test(before), 'the recording is awaited on the path to a reply');
  assert.ok(/export function recordDecisionFields/.test(diagnostics), 'the recorder is not a plain function');
  assert.ok(!/export async function recordDecisionFields/.test(diagnostics), 'the recorder returns a promise');
  return 'not awaited, and not awaitable';
});

check('the header and the table share one definition', () => {
  // An answer read off x-selodia-decision and an answer read off the table
  // disagreeing would waste a day before anybody suspected the instrument.
  assert.ok(/decision: fieldsSet\(result as Record<string, unknown>\),/.test(route), 'the header computes its own list');
  assert.ok(
    route.match(/fieldsSet\(/g)?.length === 2,
    'there is more than one place that decides what "set" means'
  );
  return 'one fieldsSet, two readers';
});

check('and this check can fail', () => {
  // The weaker version: "the fields are recorded somewhere". That passes with
  // the call sitting after the overrides, which is the arrangement that makes
  // the whole week of data wrong while looking perfectly healthy.
  assert.ok(route.includes('recordDecisionFields'), 'nothing is recorded at all');
  const recorded = route.indexOf('recordDecisionFields({');
  const override = route.indexOf('if (isPhotoOnly) photoOnlyVerdict(result);');
  assert.notStrictEqual(recorded > override, true, 'recording after the override would satisfy a weaker check');
  // And the decline rule, which is the other way the data could be quietly wrong.
  assert.strictEqual(fieldsSet({ logIntent: 'none' }).length, 0, 'a declined field counts as used');
  return 'ordering and the decline rule both load-bearing';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
