// UNITS, SAID THE WAY A PERSON SAYS THEM.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-spoken-units.mjs
//
// Ruth, 9 October 2026, after hearing a real reply: "it hilariously says
// 'Kay-CALS' and 'GEEs' for kcal and grams. Can we make her say calories and
// grams, it's way more conversational, bit odd like that, jarring almost."
//
// The reply she heard, verbatim from the call: "around 350 kcal and 25g protein
// - or the rotisserie chicken with potato salad, which runs more like 500 kcal
// and 35-40g protein". Read aloud, that is four pieces of nonsense in one
// sentence.
//
// WHY THIS IS A CHECK AND NOT A LINE IN THE PROMPT. Telling the writer to spell
// units out would work most of the time, and "most of the time" is the wrong
// standard for something that appears in every reply about food. The transform
// runs on the way to the voice and cannot be forgotten; this makes sure it also
// cannot be quietly broken.
//
// AND THE OTHER HALF, which is the part worth protecting: the STORED reply
// still says "350 kcal and 25g". That is the right form for the eye, it is what
// the Log and the reports use, and a transform that leaked into the stored text
// would change the record to suit the speaker.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { forSpeech } = await import(root + '/app/lib/voice-sink.ts');

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

console.log('\n  UNITS, SPOKEN\n');

check('the sentence she actually heard', () => {
  const heard =
    'around 350 kcal and 25g protein - or the rotisserie chicken with potato salad, which runs more like 500 kcal and 35-40g protein';
  const said = forSpeech(heard);
  assert.ok(!/kcal/i.test(said), `"kcal" survived: ${said}`);
  assert.ok(!/\d\s*g\b/.test(said), `a bare g after a number survived: ${said}`);
  assert.ok(said.includes('350 calories'), said);
  assert.ok(said.includes('25 grams'), said);
  assert.ok(said.includes('35 to 40 grams'), said);
  return '350 calories, 25 grams, 35 to 40 grams';
});

check('one of something is singular', () => {
  assert.strictEqual(forSpeech('1g of salt'), '1 gram of salt');
  assert.strictEqual(forSpeech('1 kg'), '1 kilo');
  assert.strictEqual(forSpeech('2g'), '2 grams');
  // 21 is not 1, and a decimal is never singular.
  assert.strictEqual(forSpeech('21g'), '21 grams');
  assert.strictEqual(forSpeech('1.5g'), '1.5 grams');
  return 'gram, kilo, grams, and 21 and 1.5 both plural';
});

check('the longer units are taken before the shorter ones', () => {
  // The whole reason these run in order: a bare "g" rule would otherwise eat
  // the end of "kg" and "mg" and leave "k grams".
  assert.strictEqual(forSpeech('68 kg'), '68 kilos');
  assert.strictEqual(forSpeech('75mcg'), '75mcg', 'mcg is not a unit this handles and must be left alone');
  assert.strictEqual(forSpeech('500mg'), '500 milligrams');
  assert.strictEqual(forSpeech('250ml'), '250 millilitres');
  assert.strictEqual(forSpeech('2L'), '2 litres');
  return 'kg, mg, ml, L, and mcg untouched';
});

check('ordinary words are never touched', () => {
  // The rule only fires after a digit, so nothing ending in g is at risk.
  for (const s of [
    'a big egg',
    'walking and jogging',
    'the gym',
    'logging a meal',
    'Good morning',
    'a glass of water',
  ]) {
    assert.strictEqual(forSpeech(s), s, `changed: ${s}`);
  }
  return '6 ordinary sentences, unchanged';
});

check('a hyphen between numbers becomes a word', () => {
  assert.strictEqual(forSpeech('35-40'), '35 to 40');
  // And a hyphen that is not between two numbers is left alone, because it is
  // doing a different job.
  assert.strictEqual(forSpeech('sugar-free'), 'sugar-free');
  assert.strictEqual(forSpeech('a well-earned rest'), 'a well-earned rest');
  return 'numbers joined, words left alone';
});

check('it is wired into every path that speaks', () => {
  // Three: the streamed chunks, whatever is left when the reply ends, and the
  // non-streamed path that chunks a finished reply. A new path that forgets to
  // call it is the way this regresses.
  const adapter = readFileSync('app/v1/chat/completions/route.ts', 'utf8');
  const calls = (adapter.match(/forSpeech\(/g) ?? []).length;
  assert.ok(calls >= 3, `only ${calls} spoken path(s) go through forSpeech, expected 3`);

  // And it must NOT be applied to what gets stored.
  const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8');
  assert.ok(!/forSpeech/.test(route), 'forSpeech reached the route that stores the reply');
  return `${calls} spoken paths, and the stored reply untouched`;
});

check('and this check can fail', () => {
  // The transform doing nothing is the regression that matters, and an
  // assertion about absence passes happily on an identity function.
  const identity = (s) => s;
  assert.ok(/kcal/i.test(identity('350 kcal')), 'an untransformed string is not detected');
  assert.notStrictEqual(forSpeech('350 kcal'), '350 kcal', 'forSpeech is behaving as identity');
  assert.strictEqual(forSpeech(''), '', 'empty input should stay empty');
  return 'identity detected, and empty input safe';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
