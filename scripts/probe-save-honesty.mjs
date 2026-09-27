// Does the app say a save failed only when a save actually failed?
//
// Ruth, 27 September 2026, item 6. She logged two black coffees, then asked
// "The two black coffees, you mean?" - and got ONE message saying both:
//
//   "Yes, the two black coffees - that's logged fine, no need to repeat it."
//   "Hmm, it looks like that entry didn't save for some reason. Would you mind
//    re-entering it so we can make sure it's properly logged for you?"
//
// She repeated it and got the identical pair back. It looped.
//
// NOTHING HAD FAILED. Her question was classified as a drink log, the writer
// looked for a drink in "The two black coffees, you mean?", correctly found
// none, and `landed` stayed empty - which this module read as a save gone
// missing. The model meanwhile was answering about the EARLIER log, which had
// genuinely saved. Two components answering two different questions, both
// right, contradicting each other in one bubble.
//
// This module has form for exactly this kind of gap: its partial-miss branch
// sat dead for a month because nothing ever populated the list it reads. So the
// new rule gets a probe on the day it ships rather than the day it fails.

import { unsavedNote } from '../app/lib/save-honesty.ts';

const CASES = [
  {
    why: 'THE LIVE ONE: a question about a log is not a failed log',
    attempt: { intent: 'hydration', landed: [], missed: [], attempted: false },
    expect: null,
  },
  {
    why: 'nothing was being logged at all',
    attempt: { intent: 'none', landed: [], missed: [], attempted: false },
    expect: null,
  },
  {
    why: 'it saved, so nothing is said',
    attempt: { intent: 'food', landed: ['food'], missed: [], attempted: false },
    expect: null,
  },
  {
    why: 'a write was tried and failed twice: say so',
    attempt: { intent: 'food', landed: [], missed: [], attempted: true },
    expect: 'note',
  },
  {
    why: 'half landed and we can name the half that did not',
    attempt: { intent: 'measurement', landed: ['reading'], missed: ['waist'], attempted: false },
    expect: 'note',
  },
];

let failed = 0;
const ok = (name, pass, detail) => {
  if (!pass) failed++;
  console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${name}${!pass && detail ? `\n          got: ${detail}` : ''}`);
};

console.log('\n  THE APP ONLY CLAIMS A LOSS WHEN SOMETHING WAS LOST\n');

for (const c of CASES) {
  const got = unsavedNote(c.attempt);
  const pass = c.expect === null ? got === null : typeof got === 'string' && got.length > 0;
  ok(c.why, pass, String(got));
}

// IT MUST NOT ASK HER TO TYPE IT AGAIN. Her instruction: "The chat already has
// the text. If a save fails, retry it from the message it already has; never
// ask the user to type it again." She did re-enter it, and got the same reply,
// which is how one bug became a loop.
const real = unsavedNote({ intent: 'food', landed: [], missed: [], attempted: true });
ok('a genuine failure does not ask her to re-enter it', !/re-enter|say it again|repeat it/i.test(real ?? ''), real);
ok('and it says plainly that nothing was kept', /didn't save|none of it/i.test(real ?? ''), real);

// AND IT MUST NEVER CLAIM A SAVE. One message saying both is the whole
// complaint; this half of the message is the app's, so this half can be pinned.
for (const c of CASES) {
  const got = unsavedNote(c.attempt) ?? '';
  ok(`never says "logged" while reporting a loss (${c.why.slice(0, 32)}…)`, !/\blogged fine\b|\bis logged\b/i.test(got), got);
}

console.log(`\n  ${failed === 0 ? 'all checks pass' : `${failed} FAILED`}\n`);
process.exit(failed ? 1 : 0);
