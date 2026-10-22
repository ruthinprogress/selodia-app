// THE WEEK SHOULD DRAW THE PLAN, NOT EXPLAIN WHY IT CANNOT.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-the-week-knows-its-plan.mjs
//
// Ruth, 22 October 2026, on a screen headed "If the week goes to plan": "The
// flower in Week saying stuff isn't included because it's not been logged yet
// ... reads a bit crazy right now, and its not clear why."
//
// It read oddly because it was describing an app limit as though it were a
// fact about her week. Five of her planned sessions were named in a running
// paragraph and said not to be in the drawing - which, under that heading, is
// the drawing admitting it has not drawn the plan.
//
// HER PROPOSED FIX NAMED THE WRONG REASON, and that is the part worth keeping
// here. She suggested explaining that "the duration, intensity or type have
// not been set". The words duration and intensity appear ZERO times in
// week-coverage.ts; neither is used, and duration being ignored entirely is a
// separate open question. The real rule is one line: an activity is excluded
// when its NAME has never been classified.
//
// SO IT WAS CLOSED RATHER THAN EXPLAINED. Three places, cheapest first - her
// own rows, then the shared dictionary, then the classifier, which writes back
// what it learns so nobody pays for that name twice. Measured against her real
// week: seven of eight planned sessions resolved, including "Gym - legs,
// glutes, hamstrings and hang bars (nursery day)".
//
// The eighth is the honest remainder: "Climbing at Yonder (Félix joins at 4pm,
// depends on the nanny)" is mostly logistics, and no classifier can tell what
// the session is from what it is called. That one still gets a sentence - and
// the sentence had to change too, because "log it and it will appear" is no
// longer the reason and logging it under the same name would fail identically.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { unknownNote } = await import(here('mobile/src/lib/week-coverage.ts'));

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

const lookup = fs.readFileSync('mobile/src/lib/week-coverage-lookup.ts', 'utf8');
const view = fs.readFileSync('mobile/src/components/week-view.tsx', 'utf8');
const route = fs.readFileSync('app/api/classify-names/route.ts', 'utf8');
const coverage = fs.readFileSync('mobile/src/lib/week-coverage.ts', 'utf8');

console.log('\n  THE WEEK KNOWS ITS OWN PLAN\n');

check('THE WEEK ASKS ALL THREE PLACES, CHEAPEST FIRST', () => {
  // THE CALL, not the import. Swapping the call back to knownFromLogs leaves
  // the import line intact, and the looser version of this passed on it.
  assert.ok(
    /await coverageForPlannedNames\(/.test(view),
    'the Week still only reads her own rows'
  );
  const at = lookup.indexOf('export async function coverageForPlannedNames');
  assert.ok(at > -1, 'the three-step lookup is gone');
  const body = lookup.slice(at);
  const order = ['knownFromLogs', 'knownFromDictionary', '/api/classify-names'];
  let last = -1;
  for (const step of order) {
    const i = body.indexOf(step);
    assert.ok(i > -1, `${step} is not consulted at all`);
    assert.ok(i > last, `${step} is asked out of order - the model must be last`);
    last = i;
  }
  return 'her rows, the dictionary, then the model';
});

check('AND NARROWS THE ASK AT EVERY STEP', () => {
  // A week of ordinary activities must reach the network once and the model
  // never. The whole reason this lookup exists is the warning in its own file:
  // "an AI call per unmatched activity every time the screen opens".
  const at = lookup.indexOf('export async function coverageForPlannedNames');
  const body = lookup.slice(at);
  assert.ok(/if \(missing\.length === 0\) return found;/.test(body), 'it asks on even when nothing is missing');
  const earlyExits = [...body.matchAll(/if \(missing\.length === 0\) return found;/g)];
  assert.strictEqual(earlyExits.length, 2, `${earlyExits.length} early exits, expected one per step`);
  return 'stops as soon as it knows';
});

check('AND A FAILURE COSTS NOTHING', () => {
  // Unresolved is exactly where it was before, and the Week names it as it
  // always has. A classifier that is down must not take the drawing with it.
  const at = lookup.indexOf('export async function coverageForPlannedNames');
  const body = lookup.slice(at);
  const catchAt = body.indexOf('catch (error)');
  assert.ok(catchAt > -1, 'a failed classification throws into the screen');
  // THE BLOCK ITSELF, bounded - "return found" appears after it regardless, so
  // the loose version passed happily on a catch that rethrew.
  const block = body.slice(catchAt, body.indexOf('}', body.indexOf('{', catchAt)));
  assert.ok(!/throw/.test(block), `the catch rethrows: ${block.trim()}`);
  return 'unknown stays unknown';
});

check('THE ROUTE WRITES NOTHING OF HERS', () => {
  // It answers what a NAME covers, for a plan that has not happened. Touching
  // activity_logs here would be writing a session she has not done.
  // CODE, NOT COMMENTS. The first version of this matched the route's own
  // comment saying it does NOT touch activity_logs, and failed on the sentence
  // promising the thing it was checking for. Comments describe the rule
  // constantly; only code can break it.
  const code = route.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/activity_logs/.test(code), 'the route writes to her log');
  assert.ok(/resolveCoverage/.test(route), 'it does not use the shared classifier');
  // Capped: a week is a handful of sessions, and an unbounded list is an
  // unbounded bill.
  assert.ok(/\.slice\(0, MAX_NAMES\)/.test(route), 'the list of names is unbounded');
  assert.ok(/auth\.getUser/.test(route), 'anybody can spend her model budget');
  return 'names in, coverage out, capped';
});

check('AND THE SENTENCE THAT REMAINS IS TRUE', () => {
  // "Log it and it will appear" was true when written and is not now: anything
  // placeable is already in the petals. What is left cannot be placed from its
  // name, and logging it under the same name fails identically.
  const one = unknownNote(['Climbing at Yonder (Félix joins at 4pm)']);
  assert.ok(one.includes('Climbing at Yonder'), 'the card is no longer named');
  assert.ok(!/logged/i.test(one), `it still blames logging: "${one}"`);
  assert.ok(/name/i.test(one), 'it does not say the name is the problem');
  // AND IT SAYS WHAT WOULD HELP. A sentence naming a gap with no way out of it
  // is the thing three separate fixes this week were about.
  assert.ok(/plainer name/i.test(one), 'it names the problem and offers nothing');
  return 'the name, the reason, and the way out';
});

check('AND NOTHING CLAIMS DURATION OR INTENSITY ARE INVOLVED', () => {
  // Her proposed wording said they were. They are not used anywhere in this
  // file, and writing it would have been a confident, plausible, wrong
  // explanation - the kind that is hardest to catch later.
  assert.ok(!/duration/i.test(coverage), 'week-coverage now mentions duration');
  assert.ok(!/intensity/i.test(coverage), 'week-coverage now mentions intensity');
  return 'neither, as in the code';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
