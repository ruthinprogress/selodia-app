// NO DATE SHE READS IS A STRING OF NUMBERS.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-dates-in-words.mjs
//
// Ruth, 7 October 2026, on a witness statement in her Almanac that read "You
// named a connection yourself between weeks without exercise and lower mood,
// back on 2026-09-28": dates are "always in full word format not strings of
// numbers".
//
// THE CAUSE WAS NOT THE MODEL BEING SLOPPY. Every date reaching the roundup had
// been handed to it as an ISO slice - `String(n.created_at).slice(0, 10)` - so
// the only date-shaped thing it had ever seen in that turn was numeric, and it
// copied what it was given.
//
// SO THE GUARD IS AT THE HANDOVER, NOT IN THE PROMPT. A rule saying "write dates
// as words" would be an instruction competing with the evidence in front of it,
// which is the shape of failure this repository has already paid for twice: the
// saturated fat deflection, where a rule lost to having nothing true to say, and
// the marker offer, where a closing line beat a middle paragraph. Hand over
// nothing numeric and there is nothing to reformat.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const route = readFileSync('app/api/weekly-roundup/route.ts', 'utf8');

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

console.log('\n  DATES IN WORDS\n');

check('the roundup has a words-only formatter', () => {
  assert.ok(/function inWords/.test(route), 'there is no date formatter at all');
  assert.ok(/weekday: 'long'/.test(route), 'the formatter does not name the day');
  assert.ok(/month: 'long'/.test(route), 'the formatter does not name the month in full');
  return 'weekday, day, month, all in words';
});

check('nothing numeric is handed to the model as a date', () => {
  // The three that fed the prompt: what was kept, what movement happened, and
  // when a measurement was taken.
  const blocks = [
    { name: 'what she kept', re: /\.map\(\(n\) => `\$\{([^}]+)\} \[\$\{n\.kind\}\]/ },
    { name: 'movement', re: /`\$\{([^}]+)\}: \$\{a\.activity_type/ },
    { name: 'measurements', re: /date: ([^,]+),/ },
  ];
  for (const b of blocks) {
    const m = route.match(b.re);
    assert.ok(m, `the ${b.name} block has moved, so this check is reading nothing`);
    assert.ok(
      /inWords/.test(m[1]),
      `${b.name} still hands over ${m[1].trim()}, which is a string of numbers`
    );
  }
  return 'kept, movement and measurements all in words';
});

check('and this check can fail', () => {
  // The shipped version, which produced the statement she read.
  const asShipped = "`${String(n.created_at ?? '').slice(0, 10)} [${n.kind}] ${n.title}`";
  assert.ok(!/inWords/.test(asShipped), 'the fixture is not the old behaviour');
  assert.ok(/slice\(0, 10\)/.test(asShipped), 'the fixture does not contain the fault');
  // And the real file no longer looks like it.
  assert.ok(
    !route.includes("String(n.created_at ?? '').slice(0, 10)"),
    'the old numeric handover is still in the file'
  );
  return 'the line that produced "back on 2026-09-28" is detected';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
