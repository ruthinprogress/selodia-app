// THE CURRENT GOAL, NOT ITS HISTORY.
//
// Ruth, 21 September 2026, reading her own report: "I don't think the (updated)
// from earlier section is needed. should just be current goal."
//
// Her actual rows were a goal from 12 August and one from 26 August that
// narrated its own change. Both were printed.
//
//   npx tsx scripts/probe-current-goal.mjs

import { currentGoals, withoutChangeNote } from '../app/lib/report.ts';

let passed = 0;
let failed = 0;

function group(name) { console.log(`\n  ${name.toUpperCase()}\n`); }

function check(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    passed += 1; console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
  }
}

group('the narration comes off');

// HER EXACT ROW.
check(
  'her goal, without the change note',
  withoutChangeNote('Goal is to reach 25% body fat and 40kg muscle mass (updated from earlier goal of 28%)'),
  'Goal is to reach 25% body fat and 40kg muscle mass'
);
check('was', withoutChangeNote('Back to 68kg (was 74kg)'), 'Back to 68kg');
check('revised', withoutChangeNote('Run 10k (revised in August)'), 'Run 10k');
check('previously', withoutChangeNote('25% body fat (previously 30%)'), '25% body fat');

group('what it must not touch');

// A PARENTHESIS IS NOT A CHANGE NOTE. Only one that opens by narrating a change.
check('a real parenthetical survives', withoutChangeNote('Reduce body fat (without losing muscle)'), 'Reduce body fat (without losing muscle)');
check('a measurement in brackets', withoutChangeNote('Waist under 80cm (tape at navel)'), 'Waist under 80cm (tape at navel)');
// The word boundary matters: "wasabi" is not "was". This is the character that
// spent a minute as a literal backspace.
check('a word that merely starts with was', withoutChangeNote('Eat more sushi (wasabi optional)'), 'Eat more sushi (wasabi optional)');
// NOT AT THE END, NOT A TRAILING NOTE.
check('mid-sentence is left alone', withoutChangeNote('Goal (updated) is to run further'), 'Goal (updated) is to run further');
check('nothing', withoutChangeNote(null), '');

group('only the current one');

// NEWEST FIRST is how the query returns them, so the first is the current goal.
check(
  'her two rows become one',
  currentGoals([
    'Goal is to reach 25% body fat and 40kg muscle mass (updated from earlier goal of 28%)',
    'reduce body fat and get back into old jeans',
  ]),
  ['Goal is to reach 25% body fat and 40kg muscle mass']
);
check('one row stays one', currentGoals(['Run a 10k']), ['Run a 10k']);
check('no goals at all', currentGoals([]), []);
// A ROW THAT IS NOTHING BUT A CHANGE NOTE falls through to the next real one
// rather than leaving the section empty.
check('an empty newest falls through', currentGoals(['   ', 'Run a 10k']), ['Run a 10k']);

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
