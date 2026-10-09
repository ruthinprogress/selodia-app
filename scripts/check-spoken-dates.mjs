// DATES, SAID RATHER THAN SPELLED.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-spoken-dates.mjs
//
// Ruth, 9 October 2026, testing the voice: '"FRI OCT" reading the text like a
// robot'.
//
// The reply she heard, verbatim from chat_messages: "I've only got saturated
// fat figures for the days you logged food on - Wed 7 Oct at 15g and Fri 9 Oct
// at 8g." Right for the eye, absurd out loud, and the stored row must keep
// saying "Wed 7 Oct" because that is what the Log and the reports use.
//
// AND THE NAMED CORRECTION BUG IS WHY THE ORDER MATTERS HERE. "7 Oct" has to
// become "the 7th of October" in one pass; two independent substitutions would
// leave "7 October" with no preposition, which is a different kind of robot.

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

console.log('\n  DATES, SPOKEN\n');

check('the sentence she actually heard', () => {
  const heard =
    "I've only got saturated fat figures for the days you logged food on - Wed 7 Oct at 15g and Fri 9 Oct at 8g.";
  const said = forSpeech(heard);
  assert.ok(!/\bWed\b/.test(said), `"Wed" survived: ${said}`);
  assert.ok(!/\bOct\b/.test(said), `"Oct" survived: ${said}`);
  assert.ok(!/\bFri\b/.test(said), `"Fri" survived: ${said}`);
  assert.ok(said.includes('Wednesday the 7th of October'), said);
  assert.ok(said.includes('Friday the 9th of October'), said);
  // And the units still work, because they run before the dates.
  assert.ok(said.includes('15 grams') && said.includes('8 grams'), said);
  return 'Wednesday the 7th of October, Friday the 9th of October, 15 grams';
});

check('and this check can fail', () => {
  // Every assertion above is about an absence, and absences pass happily on a
  // function that deletes everything. So: prove the raw string really does
  // contain what we claim to be removing, and that something is left.
  const raw = 'Wed 7 Oct';
  assert.ok(/\bWed\b/.test(raw) && /\bOct\b/.test(raw), 'the fixture is not the robot case');
  assert.notStrictEqual(forSpeech(raw), raw, 'forSpeech is behaving as identity on a date');
  assert.ok(forSpeech(raw).length > 10, 'the date was removed rather than expanded');
  return 'the fixture is robotic and the output is longer, not empty';
});

check('ordinals, including the three that catch everybody', () => {
  for (const [input, want] of [
    ['1 Jan', 'the 1st of January'],
    ['2 Feb', 'the 2nd of February'],
    ['3 Mar', 'the 3rd of March'],
    ['4 Apr', 'the 4th of April'],
    // 11, 12 and 13 take th, not st, nd and rd.
    ['11 May', 'the 11th of May'],
    ['12 Jun', 'the 12th of June'],
    ['13 Jul', 'the 13th of July'],
    ['21 Aug', 'the 21st of August'],
    ['22 Sep', 'the 22nd of September'],
    ['23 Nov', 'the 23rd of November'],
    ['31 Dec', 'the 31st of December'],
  ]) {
    assert.strictEqual(forSpeech(input), want);
  }
  return '11th, 12th and 13th among 11 dates';
});

check('the longer abbreviations are handled too', () => {
  assert.strictEqual(forSpeech('Tues'), 'Tuesday');
  assert.strictEqual(forSpeech('Weds'), 'Wednesday');
  assert.strictEqual(forSpeech('Thurs'), 'Thursday');
  assert.strictEqual(forSpeech('Sept'), 'September');
  // A trailing full stop is part of the abbreviation, not the sentence.
  assert.strictEqual(forSpeech('Mon.'), 'Monday');
  return 'Tues, Weds, Thurs, Sept, and a trailing stop';
});

check('ordinary words are not turned into dates', () => {
  // "May" is both a month and a verb, and this is the one that could make the
  // voice say "that October happen" if the rule were careless. May expands
  // because it is identical either way; the risk is the others.
  for (const s of [
    'a march through the park',
    'I can wander on',
    'the sun was out',
    'a satisfying meal',
    'a decent run',
    'augmented',
    'december',
  ]) {
    assert.strictEqual(forSpeech(s), s, `changed: ${s} -> ${forSpeech(s)}`);
  }
  return '7 ordinary sentences, unchanged';
});

check('a month with no day still expands', () => {
  assert.strictEqual(forSpeech('back in Oct'), 'back in October');
  assert.strictEqual(forSpeech('since Jan'), 'since January');
  return '"in Oct" is as robotic as the rest';
});

check('the stored reply is still untouched', () => {
  // The whole point: "Wed 7 Oct" is correct for the Log and the reports. A
  // transform that leaked into the stored text would change the record to suit
  // the speaker.
  const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8');
  assert.ok(!/forSpeech/.test(route), 'forSpeech reached the route that stores the reply');
  const adapter = readFileSync('app/v1/chat/completions/route.ts', 'utf8');
  assert.ok(
    (adapter.match(/forSpeech\(/g) ?? []).length >= 3,
    'fewer than three spoken paths go through forSpeech'
  );
  return 'three spoken paths, and the record keeps "Wed 7 Oct"';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
