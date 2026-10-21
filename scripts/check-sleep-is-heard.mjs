// THE PLAINEST SENTENCE ANYBODY SAYS ABOUT SLEEP HAS TO LAND.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-sleep-is-heard.mjs
//
// Ruth, 21 October 2026: "Bug: not logging sleep from chat", with a screenshot
// of the chat trying twice, failing twice and saying so:
//
//   "That didn't work either, so your sleep log is still empty, even for last
//    night on its own. Rewording it won't help, so I'm not going to ask you to
//    try a third time."
//
// The honesty was right and the parser was wrong. What she had said was:
//
//   "bed at 10, woken at 5 or 6 by Félix, then into his bed until 7 or 8"
//
// WHY IT FAILED, and it is the kind of fault that looks like bad luck and is
// not. readWindow matched two shapes: "X to Y", or the literal string "bed at
// X" followed by at most eight NON-LETTER characters and then one of three
// wake words. So "and" broke it, because "and" is made of letters. "woken" was
// not one of the three wake words - only "woke", "got up", "was awake". And
// readClock accepted "5:30" but not "5.30", so a time could be found by the
// search and thrown away by the parse, which looks from outside exactly like a
// sentence with no time in it.
//
// SEVEN OF THESE TEN RETURNED NOTHING before this was written, including "I
// went to bed at 10 and woke at 6" - the sentence the feature exists for.
//
// AND NOTHING COVERED IT. parseSleep had no check of any kind, which is the
// whole reason it could be this broken for a month without anybody knowing. A
// rule this project already holds: a test must be able to fail, and a thing
// with no test fails silently in front of the person it was built for.

import assert from 'node:assert';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { parseSleep } = await import(here('app/lib/sleep-logging.ts'));

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

// A Wednesday evening, so "last night" is Tuesday night.
const NOW = new Date(2026, 9, 21, 19, 57);
const read = (text) => parseSleep(text, NOW);

console.log('\n  SLEEP, AS PEOPLE ACTUALLY SAY IT\n');

check('HER OWN SENTENCE, WHICH IS WHY THIS EXISTS', () => {
  const r = read('bed at 10, woken at 5 or 6 by Felix, then into his bed until 7 or 8');
  assert.ok(r, 'the message that prompted the bug report still writes nothing');
  assert.strictEqual(r.wentToBed, '22:00', 'ten at night was not read as a bedtime');
  // THE LAST WAKING ENDS THE NIGHT. Being woken at five is a waking; getting up
  // at seven is the morning. Taking the first would have recorded seven hours
  // of sleep as seven minutes short of a different night.
  assert.strictEqual(r.wokeAt, '07:00', 'the night ended at the first waking rather than the last');
  assert.strictEqual(r.durationMin, 540);
  return 'bed 22:00, up 07:00, 9h';
});

check('AND THE SENTENCE THE FEATURE EXISTS FOR', () => {
  // Words between the two times are somebody's night, not a delimiter.
  const plain = read('I went to bed at 10 and woke at 6');
  assert.ok(plain, '"went to bed at 10 and woke at 6" writes nothing');
  assert.strictEqual(plain.wentToBed, '22:00');
  assert.strictEqual(plain.wokeAt, '06:00');
  assert.strictEqual(plain.durationMin, 480);

  const withAmPm = read('last night I went to bed at 10pm and got up at 7am');
  assert.strictEqual(withAmPm.durationMin, 540, 'am/pm spelled out broke it');

  const terse = read('bed 10pm woke 6am');
  assert.ok(terse && terse.durationMin === 480, 'the terse form writes nothing');
  return 'three plain phrasings, all landing';
});

check('A DOT IS A COLON', () => {
  // The time was found and then thrown away, which from outside is
  // indistinguishable from a sentence with no time in it.
  const r = read('went to bed at 10 last night, up at 5.30, then dozed until 7.30');
  assert.ok(r, '"5.30" is not read as half past five');
  assert.strictEqual(r.wokeAt, '07:30');
  assert.strictEqual(r.wentToBed, '22:00');
  return '5.30 reads the same as 5:30';
});

check('AND THE RANGE FORM STILL WINS WHERE IT IS GIVEN', () => {
  // It names both times at once and cannot be misread, so it is tried first.
  const r = read('slept 10pm to 7am');
  assert.strictEqual(r.wentToBed, '22:00');
  assert.strictEqual(r.wokeAt, '07:00');
  const spoken = read('half eleven till six');
  assert.ok(spoken && spoken.wentToBed === '23:30' && spoken.wokeAt === '06:00', 'spoken clock times broke');
  return 'written and spoken ranges both';
});

check('A NIGHT WITH NO CLOCK IN IT IS STILL A NIGHT', () => {
  // "Everything is optional except the night" - a guess in the duration column
  // would read later as a measurement.
  const bad = read('I slept badly, woken twice');
  assert.ok(bad, 'a night described only in words writes nothing');
  assert.strictEqual(bad.quality, 'poor');
  assert.strictEqual(bad.durationMin, null, 'hours were invented for a night that named none');
  const hours = read('I got about 7 hours');
  assert.strictEqual(hours.durationMin, 420);
  assert.strictEqual(hours.wentToBed, null, 'a bedtime was invented from a duration');
  return 'words without hours, hours without words';
});

check('A COUNT OF WAKINGS IS NOT A TIME', () => {
  // "woke 3 times" is three wakings, not three o'clock. The wake search had to
  // be taught to refuse a number followed by "times" or it would have recorded
  // somebody getting up at 3am every time they said how broken the night was.
  const r = read('bed at 11, woke 3 times');
  assert.ok(r, 'a broken night writes nothing');
  assert.notStrictEqual(r.wokeAt, '03:00', 'three wakings became three in the morning');
  assert.strictEqual(r.awakenings, 3, 'the wakings were not counted');
  return 'three times is not three o-clock';
});

check('AND A MESSAGE THAT IS NOT ABOUT ONE NIGHT IS REFUSED', () => {
  // The guard at the write. The model may call a message a sleep log and be
  // wrong, and a row invented from "every night this week" would be a fact
  // about a night that was never described.
  assert.strictEqual(
    read('I was woken at 5 or 6 every night this week'),
    null,
    'a fortnight of broken nights was written as one night'
  );
  assert.strictEqual(read('what does my sleep look like?'), null, 'a question wrote a row');
  assert.strictEqual(read('I am shattered'), null, 'being tired wrote a night');
  return 'no night, no row';
});

check('AND THE NIGHT IS THE ONE THEY MEANT', () => {
  // Said on Wednesday evening, "last night" is Tuesday night - people do not
  // say it about the sleep they are heading into.
  const r = read('last night I went to bed at 10 and woke at 6');
  assert.strictEqual(r.nightOf, '2026-10-20', `landed on ${r.nightOf}`);
  return 'Tuesday night, said on Wednesday evening';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
