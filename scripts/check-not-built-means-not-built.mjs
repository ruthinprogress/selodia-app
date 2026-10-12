// A PROMPT MAY ONLY SAY A THING IS NOT BUILT WHILE IT IS NOT BUILT.
//
//   node scripts/check-not-built-means-not-built.mjs
//
// Ruth, 18 September 2026: she asked twice for a reminder to drink water at 9am
// and was told it was not possible. Custom reminders were then built, and the
// CAPABILITIES block in ask-selodia was updated to say a reminder in her own
// words is real.
//
// Its worked example of "something not built yet", five lines further down the
// same block, was still: "a water-specific reminder is not built". So the model
// was told a reminder is real and that a reminder is not built, in one breath.
// The example of a missing feature was the feature that had just been added.
// Found 12 October 2026, nearly a month later, while answering her question
// "how can it add a reminder?".
//
// AND THE WRITER WAS TOLD NOTHING AT ALL. reply-prompt.ts, the prompt of the
// model that actually speaks to her, did not contain the word "reminder". So
// "can you remind me?" was answered by the half of the turn that did not know
// reminders exist - the exact fault check-both-models-see-it was written for,
// for a capability nobody had added to its list.
//
// WHY A CHECK AND NOT A NOTE. This is the same fault twice: a feature status
// written into prose, true on the day, silently false the day the feature
// changes. The example in CAPABILITIES is now the calendar, which genuinely is
// not built - and Ruth has said the calendar is needed for the medical access
// route. The day a calendar field is added to the classifier, that example
// becomes false in exactly the same way. This check fails on that day.
//
// THE RULE IT ENFORCES. For each capability below: if the classifier has its
// field, no prompt sentence may call it not built, AND the writer's prompt must
// mention it. If the classifier does not have its field, saying so is allowed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROUTE = path.join(ROOT, 'app', 'api', 'ask-selodia', 'route.ts');
const REPLY = path.join(ROOT, 'app', 'lib', 'reply-prompt.ts');

const read = (f) => fs.readFileSync(f, 'utf8').split('\r\n').join('\n');
// Whole-line comments only. The history of a fix is allowed to name the thing
// that used to be wrong; a prompt is not.
const stripLineComments = (s) => s.replace(/^\s*\/\/.*$/gm, '');

/**
 * Capabilities whose status the prompts describe in words.
 *
 * `field` is the classifier schema property that means the capability exists.
 * Add a row here when a prompt starts saying something about a new one.
 */
const CAPABILITIES = [
  { name: 'reminder', word: /\breminders?\b/i, field: 'reminderAction' },
  { name: 'calendar', word: /\bcalendar\b/i, field: 'calendarAction' },
];

// Narrow on purpose. "Never say a reminder is not possible" is an instruction
// NOT to deny it, and must not read as a denial.
const DENIAL = /\bnot (?:yet )?built\b|\bisn't built\b|\bcannot write to\b/i;

/**
 * Clauses, not sentences.
 *
 * The first version matched whole sentences and flagged the corrected example
 * itself: "a reminder in their own words ... is real and can be set now, but the
 * app cannot write to the calendar". One sentence, two capabilities, and the
 * denial belongs to the calendar. A sentence comparing what exists with what
 * does not is exactly the sentence these prompts are meant to contain, so the
 * denial has to sit in the same clause as the thing it denies.
 */
function clauses(text) {
  return text.split(/(?<=[.?!])\s+|[,;:]\s+|\s+-\s+/);
}

/** Clauses that call this capability not built. */
export function denials(text, capability) {
  return clauses(text).filter((s) => capability.word.test(s) && DENIAL.test(s));
}

/** Whether the classifier schema in this source defines the capability's field. */
export function hasField(routeSource, field) {
  return new RegExp(`\\b${field}\\s*:\\s*\\{`).test(routeSource);
}

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
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

const route = stripLineComments(read(ROUTE));
const reply = stripLineComments(read(REPLY));

console.log('\n  A PROMPT MAY ONLY SAY A THING IS NOT BUILT WHILE IT IS NOT BUILT\n');

check('nothing the classifier can do is described as not built', () => {
  const wrong = [];
  for (const c of CAPABILITIES) {
    if (!hasField(route, c.field)) continue;
    for (const [where, text] of [
      ['ask-selodia/route.ts', route],
      ['reply-prompt.ts', reply],
    ]) {
      for (const s of denials(text, c)) wrong.push(`${where} calls ${c.name} not built: "${s.trim().slice(0, 140)}"`);
    }
  }
  ok(wrong.length === 0, wrong.join('\n          '));
  const built = CAPABILITIES.filter((c) => hasField(route, c.field)).map((c) => c.name);
  return `built: ${built.join(', ') || 'none'} - none denied`;
});

check('the model that speaks to her knows about everything that is built', () => {
  // check-both-models-see-it's rule, applied to capabilities rather than facts.
  const unknown = CAPABILITIES.filter((c) => hasField(route, c.field) && !c.word.test(reply)).map(
    (c) => c.name
  );
  ok(
    unknown.length === 0,
    `reply-prompt.ts never mentions: ${unknown.join(', ')}. The classifier can do it and the ` +
      'writer, which is the one she talks to, does not know it exists.'
  );
  return 'every built capability is named to the writer';
});

check('and this check can fail', () => {
  // The line that shipped, against a source where reminders exist.
  const routeWithReminders = 'reminderAction: { type: "string" }';
  ok(hasField(routeWithReminders, 'reminderAction'), 'a defined field reads as absent');
  const shipped =
    'For example, asked for a 9am water reminder: the daily log reminders exist and can be set to any time, but they prompt logging rather than drinking, and a water-specific reminder is not built - so say that.';
  ok(denials(shipped, CAPABILITIES[0]).length === 1, 'the 12 October contradiction is not detected');

  // A sentence that sets the real thing beside the missing one is allowed.
  const corrected =
    'a reminder in their own words at a time they name is real and can be set now, but the app cannot write to the calendar on their phone - so say that.';
  ok(denials(corrected, CAPABILITIES[0]).length === 0, 'the corrected example reads as denying reminders');
  ok(denials(corrected, CAPABILITIES[1]).length === 1, 'the corrected example no longer denies the calendar');

  // The instruction NOT to deny must not read as a denial.
  ok(
    denials('Never say a reminder is not possible.', CAPABILITIES[0]).length === 0,
    'an instruction against denying reads as a denial'
  );

  // And the calendar sentence becomes a failure the day the calendar is built.
  const calendarSentence = 'The app cannot write to the calendar on their phone.';
  ok(denials(calendarSentence, CAPABILITIES[1]).length === 1, 'the calendar denial is not seen');
  ok(!hasField(route, 'calendarAction'), 'calendarAction exists - update the calendar sentences in both prompts');
  return 'the shipped line fails, and the calendar line will fail when calendar lands';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
