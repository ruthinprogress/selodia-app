// SOMETHING CAN GET INTO HER WEEK, AND CHAT CAN READ IT BACK.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-week-add.mjs
//
// Ruth, 1 October 2026: "I start a new class, like french class, and I want to
// see it in the week because it blocks that evening availability for movement.
// I tap plus and at the bottom of pre-existing activities I do, I can Text add.
// But I can always discuss it with chat if I want to and it will know what it
// is. I can also ask chat directly to add french class on thursday night at
// 7pm."
//
// FOUR WAYS THIS FEATURE CAN BE WRONG AND LOOK RIGHT, which is what the groups
// below are:
//
//   weekFacts      Chat could write to her week an hour before it could read
//                  it. A block that renders nothing, or renders a row with no
//                  day and calls it blank, means Selodía still cannot answer
//                  "what have I got on Thursday".
//   coerceProposal "thursday" has to become "thu" and "7pm" has to survive
//                  unparsed. A time quietly dropped here is the whole reason
//                  she wanted the class in her week in the first place.
//   wording        A week entry has never gone to the Almanac. Three separate
//                  sentences used to say it did, because week was added to a
//                  type union whose every other member is an Almanac entry.
//   days_chosen_at The row is written and never seen. Under "Let me lead" the
//                  Week screen hides a card on a day she did not choose, so an
//                  unstamped insert is indistinguishable from the add silently
//                  failing - the exact bug that cost a morning on 1 October.
//
// THE DAYS_CHOSEN_AT GROUP IS A SOURCE CHECK, deliberately. There are TWO
// writes into user_week now - one in the app and one on the server - because
// there are two runtimes, and the stamp has to be at both. Nothing at runtime
// can see both, so this reads the files. A source check is weak evidence about
// behaviour and strong evidence about a rule holding in two places.
//
// EVERY GROUP IS PROVED ABLE TO FAIL at the bottom. See MUTATION.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import { weekFacts } from '../app/lib/week-facts.ts';
import { coerceProposal, offerQuestionFor, saveAppliedNote } from '../app/lib/pending-save.ts';

let pass = 0;
const failures = [];

function check(group, name, fn) {
  try {
    fn();
    pass += 1;
  } catch (e) {
    failures.push(`${group} / ${name}: ${e.message}`);
  }
}

const GROUPS = {};

// ------------------------------------------------------------------ weekFacts

GROUPS.weekFacts = (facts) => {
  const FRENCH = [
    { activity: 'French class', days: ['thu'], time_of_day: '7pm', duration: null, cadence: null, purpose: null },
  ];

  check('weekFacts', 'her class is in it, with its day and its time', () => {
    const out = facts(FRENCH);
    assert.match(out, /French class/);
    assert.match(out, /Thursday/);
    assert.match(out, /7pm/);
  });

  check('weekFacts', 'an empty week says nothing rather than saying it is empty', () => {
    // A block of prose about having no week would be spent context on every
    // turn of a conversation that is not about her week.
    assert.equal(facts([]), '');
    assert.equal(facts(null), '');
    assert.equal(facts(undefined), '');
  });

  check('weekFacts', 'a row with no days reads as Anytime, not as a blank', () => {
    const out = facts([{ activity: 'Walking', days: [], cadence: 'most days' }]);
    assert.match(out, /Walking/);
    assert.match(out, /Anytime/i);
  });

  check('weekFacts', 'a row with no activity is skipped, not rendered empty', () => {
    const out = facts([{ activity: null, days: ['mon'] }, ...FRENCH]);
    assert.doesNotMatch(out, /^- : /m);
    assert.match(out, /French class/);
  });

  check('weekFacts', 'it says not everything in a week is exercise', () => {
    // Without this the model reads a French class as training and answers
    // nonsense. Her own example, and the reason the sentence is there.
    assert.match(facts(FRENCH), /not exercise|OCCUPIES/i);
  });

  check('weekFacts', 'it carries no field names into the writer', () => {
    // The writer has no tool. A block that names proposedSave or time_of_day
    // comes back as JSON in her message - that happened on 30 September.
    const out = facts(FRENCH);
    assert.doesNotMatch(out, /proposedSave|time_of_day|user_week/);
  });
};

// ------------------------------------------------------------- coerceProposal

GROUPS.coerceProposal = (coerce) => {
  check('coerceProposal', 'thursday night at 7pm keeps both the day and the time', () => {
    const p = coerce({
      type: 'week',
      title: 'French class',
      content: { days: ['thursday'], time: '7pm' },
    });
    assert.ok(p, 'the proposal was refused outright');
    assert.deepEqual(p.content.days, ['thu']);
    assert.equal(p.content.time_of_day, '7pm');
  });

  check('coerceProposal', 'a time in her words is not turned into a clock', () => {
    const p = coerce({
      type: 'week',
      title: 'Ballet',
      content: { days: ['mon'], time: 'after the school run' },
    });
    assert.equal(p.content.time_of_day, 'after the school run');
  });

  check('coerceProposal', 'no time at all is null, not invented', () => {
    const p = coerce({ type: 'week', title: 'Gym', content: { days: ['wed'] } });
    assert.equal(p.content.time_of_day, null);
  });

  check('coerceProposal', 'a made-up day is dropped rather than written', () => {
    const p = coerce({ type: 'week', title: 'Gym', content: { days: ['someday', 'wed'] } });
    assert.deepEqual(p.content.days, ['wed']);
  });

  check('coerceProposal', 'no days at all is accepted - Anytime is a real answer', () => {
    const p = coerce({ type: 'week', title: 'Walking', content: {} });
    assert.ok(p, 'an Anytime activity was refused');
    assert.deepEqual(p.content.days, []);
  });
};

// -------------------------------------------------------------------- wording

GROUPS.wording = ({ question, applied }) => {
  check('wording', 'the offer names her week, not her Almanac', () => {
    const q = question('week');
    assert.match(q, /week/i);
    assert.doesNotMatch(q, /almanac/i);
  });

  check('wording', 'the confirmation sends her to Plans, not the Almanac', () => {
    const line = applied({ kind: 'week', title: 'French class' }, true);
    assert.match(line, /week/i);
    assert.doesNotMatch(line, /almanac|insights/i);
  });

  check('wording', 'the confirmation does not call her "they"', () => {
    // The type word is "something in their week", written for the model's
    // prompt. Falling through to the generic sentence put it in front of her.
    assert.doesNotMatch(applied({ kind: 'week', title: 'Gym' }, true), /\btheir\b/i);
  });

  check('wording', 'the other destinations are unchanged', () => {
    // A guard on the change itself: week must not have been bolted on by
    // breaking what me and rule already said correctly.
    assert.match(applied({ kind: 'me', title: 'Skincare' }, true), /Me/);
    assert.match(applied({ kind: 'rule', title: 'No burpees' }, true), /rules/i);
    assert.match(question('me'), /Me tab/i);
  });
};

// ------------------------------------------------------------- days_chosen_at

GROUPS.stamp = (read) => {
  const WRITES = [
    ['mobile/src/lib/week-move.ts', 'addToWeek', 'the app'],
    ['app/lib/pending-save.ts', "proposal.type === 'week'", 'the server'],
  ];

  for (const [file, marker, who] of WRITES) {
    check('stamp', `${who}'s write stamps days_chosen_at`, () => {
      const src = read(file);
      const at = src.indexOf(marker);
      assert.ok(at >= 0, `${marker} is not in ${file} - this check is looking at the wrong place`);
      // The insert that follows the marker, generously bounded.
      const region = src.slice(at, at + 3000);
      assert.ok(
        /user_week/.test(region),
        `no user_week insert found after ${marker} in ${file}`
      );
      assert.ok(
        /days_chosen_at/.test(region),
        `${file} inserts into user_week without days_chosen_at. Under "Let me lead" the ` +
          'row is written and the card never appears on the day.'
      );
    });
  }
};

// ----------------------------------------------------------------------- RUN

GROUPS.weekFacts(weekFacts);
GROUPS.coerceProposal(coerceProposal);
GROUPS.wording({ question: offerQuestionFor, applied: saveAppliedNote });
GROUPS.stamp((f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8'));

// ------------------------------------------------------------------- MUTATION
//
// PROVE EACH GROUP CAN FAIL. A suite that passes against an implementation
// answering nothing was testing its own wording. This has caught two checks in
// this repo already.

const EMPTY = {
  weekFacts: () => '',
  coerceProposal: () => null,
  wording: { question: () => 'Want me to keep that in your Almanac?', applied: () => null },
  stamp: () => '',
};

const mutationFailures = [];
for (const [name, run] of Object.entries(GROUPS)) {
  const before = failures.length;
  const realPass = pass;
  run(EMPTY[name]);
  const brokeSomething = failures.length > before;
  failures.length = before;
  pass = realPass;
  if (!brokeSomething) {
    mutationFailures.push(
      `${name}: every check still passed against an implementation that answers nothing. ` +
        'These checks are not testing behaviour.'
    );
  }
}

for (const f of failures) console.error('  FAIL  ' + f);
for (const f of mutationFailures) console.error('  USELESS  ' + f);

console.log(`\n  ${pass} passed, ${failures.length} failed, ${mutationFailures.length} useless`);
if (failures.length + mutationFailures.length > 0) process.exit(1);
