// THE SLEEP OBSERVATION SAYS ONE TRUE THING, OR NOTHING.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-the-observation-stays-quiet.mjs
//
// Ruth's artwork put a card under last night: "Your sleep has been longer on
// days you go for a morning walk." Then, on the heading: "dont say 'selodia
// notices', just the insight I think."
//
// She is right about the heading and it is not only tone. Naming the app as the
// noticer makes it somebody handing down a verdict; the sentence alone is a
// fact about her own record that she can weigh herself.
//
// WHAT THIS GUARDS IS THE SILENCE. An insight card is the easiest thing in an
// app to make dishonest, because the pressure is always to have something to
// say. With seven nights logged there usually is not, and a card that reaches
// is worse than a screen without one.
//
// THE FAILURE THAT IS EASY TO WRITE AND HARD TO SEE: comparing one group
// against a total instead of against the other group. Four nights of walking
// and one night of not walking would then read as a pattern when it is one
// night. So the minimum is on BOTH sides, and that is what most of these cases
// are about.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { sleepObservation, MIN_EACH_SIDE, MIN_DIFFERENCE_MIN } = await import(
  root + '/mobile/src/lib/sleep-insight.ts'
);

const SCREEN = readFileSync('mobile/src/app/(tabs)/log/sleep.tsx', 'utf8');

let pass = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    pass += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

/** n nights of `minutes`, dated backwards from a fixed day, walked or not. */
function nights(count, minutes, morning, offset = 0) {
  const out = { nights: [], days: [] };
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(2026, 9, 1 + offset + i));
    const date = d.toISOString().slice(0, 10);
    out.nights.push({ nightOf: date, minutes });
    out.days.push({ date, activeMinutes: 30, morning });
  }
  return out;
}

function both(walked, didnt) {
  return {
    nights: [...walked.nights, ...didnt.nights],
    days: [...walked.days, ...didnt.days],
  };
}

// -- the silence, which is the default -------------------------------------

check('nothing to say with no nights at all', () => {
  assert.equal(sleepObservation([], []), null);
});

check('nothing to say on one side of the comparison', () => {
  // Four walked nights and one that was not. The easy, wrong version of this
  // calls that a pattern.
  const data = both(nights(4, 480, true), nights(1, 360, false, 10));
  assert.equal(
    sleepObservation(data.nights, data.days),
    null,
    `one night is not a comparison - ${MIN_EACH_SIDE} are needed on each side`
  );
});

check('nothing to say when the difference is trivial', () => {
  const data = both(nights(4, 450, true), nights(4, 440, false, 10));
  assert.equal(
    sleepObservation(data.nights, data.days),
    null,
    `ten minutes is noise; the floor is ${MIN_DIFFERENCE_MIN}`
  );
});

check('nothing to say about nights with no duration', () => {
  const data = both(nights(4, 480, true), nights(4, 360, false, 10));
  const blank = data.nights.map((n) => ({ ...n, minutes: null }));
  assert.equal(sleepObservation(blank, data.days), null, 'it spoke about nights with no figure');
});

check('nothing to say when no day lines up with a night', () => {
  const { nights: ns } = nights(8, 480, true);
  assert.equal(sleepObservation(ns, []), null, 'it compared nights against no activity at all');
});

// -- and when it does speak ------------------------------------------------

check('it speaks when both sides are real and the gap is real', () => {
  const data = both(nights(4, 480, true), nights(4, 360, false, 10));
  const said = sleepObservation(data.nights, data.days);
  assert.ok(said, 'it stayed silent on a genuine pattern');
  assert.match(said, /longer/, 'it did not name the direction');
  assert.match(said, /morning/, 'it did not name what it is comparing against');
});

check('it will say the unflattering direction too', () => {
  // The artwork's sentence is the happy one. An insight that can only report
  // the flattering half is an advert.
  const data = both(nights(4, 360, true), nights(4, 480, false, 10));
  const said = sleepObservation(data.nights, data.days);
  assert.ok(said, 'it stayed silent when the pattern went the other way');
  assert.match(said, /shorter/, 'it refused to say the less welcome thing');
});

check('it talks about the past, never the future', () => {
  const data = both(nights(4, 480, true), nights(4, 360, false, 10));
  const said = sleepObservation(data.nights, data.days);
  assert.match(said, /has been/, 'it is not written as a statement about the record');
  assert.doesNotMatch(
    said,
    /\bwill\b|\bshould\b|\btry\b|\bhelps?\b|\bimproves?\b|\bbetter if\b/i,
    'it is making a promise or a recommendation, which SELODIA_LANGUAGE_RULES '
      + 'and Part Twelve both forbid: "you slept longer on days you walked" is a '
      + 'fact, "walking will fix your sleep" is not'
  );
});

check('it never grades the night', () => {
  const data = both(nights(4, 480, true), nights(4, 360, false, 10));
  const said = sleepObservation(data.nights, data.days);
  assert.doesNotMatch(
    said,
    /\benough\b|\btarget\b|\bgoal\b|\bshort of\b|\bpoor\b|\bbad\b/i,
    'it is judging the sleep. This screen records; it does not grade.'
  );
});

// -- and the screen renders it the way she asked --------------------------

check('no heading names the app as the noticer', () => {
  assert.doesNotMatch(
    SCREEN,
    /Selod[ií]a noticed/i,
    'the "Selodía noticed" heading is back. Her instruction: "dont say \'selodia '
      + 'notices\', just the insight I think."'
  );
});

check('the card is absent rather than empty when there is nothing', () => {
  assert.match(
    SCREEN,
    /\{observation \?/,
    'the observation card renders unconditionally, so a screen with nothing to '
      + 'say would draw an empty green box'
  );
});

// -- every case above must be able to fail ---------------------------------

const useless = [];
function mustFail(name, fn) {
  try {
    fn();
    useless.push(name);
  } catch {
    /* threw, which is the point */
  }
}

mustFail('one side is refused', () => {
  const d = both(nights(4, 480, true), nights(1, 360, false, 10));
  assert.ok(sleepObservation(d.nights, d.days));
});
mustFail('a real pattern is reported', () => {
  const d = both(nights(4, 480, true), nights(4, 360, false, 10));
  assert.equal(sleepObservation(d.nights, d.days), null);
});
mustFail('promises are rejected', () =>
  assert.doesNotMatch('walking will help your sleep', /\bwill\b/i)
);
mustFail('the heading is checked', () => assert.match(SCREEN, /Selod[ií]a noticed/i));

for (const f of failures) console.log(`  FAIL  ${f}`);
for (const u of useless) console.log(`  USELESS  "${u}" passed with its premise inverted`);

const total = pass + failures.length;
console.log(`${pass}/${total} passed, ${failures.length} failed, ${useless.length} useless`);
process.exit(failures.length + useless.length > 0 ? 1 : 0);
