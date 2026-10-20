// WHAT A PLANNED WEEK WOULD COVER.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-week-flower.mjs
//
// Ruth, 20 October 2026: "we have a Week Planner, and it doesnt connect to the
// Health Flower at all. Would it be useful to have a health flower in Week so
// the design could help you build a weekly plan that covers what you need?"
//
// THE WHOLE RISK IS THAT THIS BECOMES A SCORE. The Week lost its ticks that
// same morning - "Its a template not a to do list" - and a drawing that fills
// up is the most natural thing in the world to start optimising. So the checks
// below are mostly about what it must never do: know whether she did any of it,
// recommend anything, or outrank the sentence promising this screen is not a
// score.
//
// AND IT IS ALLOWED TO NAME GAPS, which the drawing on Now is not. That is not
// an inconsistency to be tidied later, it is the point: Now is drawn from the
// Movement log and describes a life already lived, where "what is missing"
// would be a verdict on somebody. This describes a plan, and what a plan does
// not cover is a fact about the plan. Her line: "see where there may be gaps to
// support protective movement and make sure you're allowing for enough rest."

import assert from 'node:assert';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { plannedCoverage, planGapNote, THIN, unknownNote, anytimeNote } = await import(
  here('mobile/src/lib/week-coverage.ts')
);
const { DIMENSION_LABEL } = await import(here('mobile/src/lib/health-flower.ts'));

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

const label = (d) => DIMENSION_LABEL[d];
/**
 * Source with its comments gone, so a check cannot match its own prose.
 *
 * FOURTH TIME TODAY. Every one of these files explains the fault it guards, in
 * the words of the fault, directly above the guard - so a regex looking for
 * "logged" or "Move to" finds the explanation and reports the bug it just
 * fixed. The code is the thing being tested.
 */
const codeOnly = (src) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const view = codeOnly(fs.readFileSync('mobile/src/components/week-view.tsx', 'utf8'));
const lib = codeOnly(fs.readFileSync('mobile/src/lib/week-coverage.ts', 'utf8'));
const viewRaw = fs.readFileSync('mobile/src/components/week-view.tsx', 'utf8');
const serverWeights = fs.readFileSync('app/lib/activity-weights.ts', 'utf8');
const phoneWeights = fs.readFileSync('mobile/src/lib/activity-weights.ts', 'utf8');

console.log('\n  IF THE WEEK GOES TO PLAN\n');

check('THE TWO WEIGHTING TABLES ARE THE SAME TABLE', () => {
  // The phone's copy is generated from the server's. Three places hold these
  // numbers and none is typed by hand: the spec, the server parsed from it,
  // and the phone copied from the server.
  const carve = (t) => {
    const from = t.indexOf('export type Coverage = {');
    const fn = t.indexOf('export function coverageFor');
    return t.slice(from, t.indexOf('\n}', fn) + 2);
  };
  assert.ok(/GENERATED FILE\. DO NOT EDIT\./.test(phoneWeights), 'the phone copy is hand-maintained');
  assert.strictEqual(
    carve(phoneWeights),
    carve(serverWeights),
    'the phone and the server disagree about the weightings - run scripts/generate-mobile-weights.mjs'
  );
  return 'identical, and the copy says it is generated';
});

check('A CARD COUNTS ONCE PER DAY IT IS ON', () => {
  // Ballet on Tuesday and Thursday is two sessions, and the plan is two
  // sessions heavier for it.
  const once = plannedCoverage([{ activity: 'ballet', days: ['tue'] }]);
  const twice = plannedCoverage([{ activity: 'ballet', days: ['tue', 'thu'] }]);
  assert.strictEqual(once.sessions, 1);
  assert.strictEqual(twice.sessions, 2, 'two days did not count as two sessions');
  assert.ok(twice.coverage.balance > once.coverage.balance, 'the second day added nothing');
  // AN ANYTIME CARD COUNTS FOR NOTHING (Ruth, 20 October 2026): "Anytime
  // shouldn't be in flower... the recommendations and cumulative protective
  // qualities are weekly." Checked externally and she is right - the WHO
  // states all of it per week. A card with no day has no cadence, so counting
  // it claims one she never gave.
  const anytime = plannedCoverage([{ activity: 'ballet', days: [] }]);
  assert.strictEqual(anytime.sessions, 0, 'an Anytime card was counted as a session');
  assert.strictEqual(anytime.anytime, 1, 'the Anytime card is not counted so it can be said');
  for (const d of Object.keys(anytime.coverage)) {
    assert.strictEqual(anytime.coverage[d], 0, `an Anytime card filled ${d}`);
  }
  // AND THAT IS WHAT MAKES THE DRAWING WORTH PLAYING WITH, which she saw
  // straight afterwards: "A user should be able to quickly see the overall
  // shape of the flower by dropping things in and out from anytime, it's body
  // literacy aid." If Anytime counted, dragging a card onto a day would change
  // nothing at all.
  const onADay = plannedCoverage([{ activity: 'ballet', days: ['tue'] }]);
  assert.ok(
    onADay.coverage.balance > anytime.coverage.balance,
    'dragging a card out of Anytime onto a day changes nothing, so the drawing teaches nothing'
  );
  return 'per day, and Anytime for nothing';
});

check('AN UNKNOWN ACTIVITY IS NAMED, NEVER SILENTLY DROPPED', () => {
  // The server classifies unknown names with an AI call at log time. Doing that
  // here would be a call per unrecognised card every time the tab opens, to
  // answer a question about a plan - so it is reported instead, which is also
  // more useful than a quietly thinner drawing.
  const p = plannedCoverage([
    { activity: 'ballet', days: ['tue'] },
    { activity: 'Pull-up practice', days: ['tue', 'thu'] },
  ]);
  assert.deepStrictEqual(p.unknown, ['Pull-up practice'], 'the unknown card is not reported');
  assert.strictEqual(p.sessions, 1, 'the unknown card was counted as a session anyway');
  // Named once however many days it sits on.
  assert.strictEqual(p.unknown.length, 1, 'it is named once per day rather than once');
  // THE BEHAVIOUR, NOT THE WORDING. This used to match the literal sentence
  // "I do not know yet what", which meant it broke the moment the copy was
  // rewritten on 20 October - and would have passed just as happily if the
  // rewrite had quietly dropped the names. What matters is that the card is
  // NAMED, so that is what is asserted.
  const note = unknownNote(['Rocket Yoga', 'Pull-up practice']);
  assert.ok(note, 'nothing is said about a card that cannot be read');
  for (const name of ['Rocket Yoga', 'Pull-up practice']) {
    assert.ok(note.includes(name), `the note no longer names "${name}"`);
  }
  assert.strictEqual(unknownNote([]), null, 'a plan with nothing unknown still says something');
  const one = unknownNote(['Rocket Yoga']);
  assert.ok(/\bhas\b/.test(one) && !/\bthey\b/i.test(one), `one card reads as many: "${one}"`);
  assert.ok(/unknownNote\(plan\.unknown\)/.test(viewRaw), 'the screen no longer draws that note');

  // AND HER OWN LOGS ANSWER IT WHEN THE TABLE CANNOT. Ruth asked why "Pull-up
  // practice" counted for nothing. The table is thirty-one broad activity
  // TYPES; anything else is classified by the server with an AI call once, at
  // log time, and written onto that row. So the answer was already in her
  // rows, paid for, and the Week was ignoring it.
  const known = {
    'pull-up practice': {
      strength: 80,
      cardio: 20,
      flexibility: 15,
      balance: 25,
      bone: 30,
      recovery: 0,
    },
  };
  const learned = plannedCoverage(
    [{ activity: 'Pull-up practice', days: ['tue'] }],
    known
  );
  assert.deepStrictEqual(learned.unknown, [], 'a previously logged activity is still called unknown');
  assert.strictEqual(learned.sessions, 1, 'a previously logged activity still counts for nothing');
  assert.ok(learned.coverage.strength > 0, 'the coverage from her own log was not used');
  // IT IS A LOOKUP, NOT A GUESS: nothing is inferred from a similar name.
  const unrelated = plannedCoverage([{ activity: 'Pull-ups', days: ['tue'] }], known);
  assert.deepStrictEqual(unrelated.unknown, ['Pull-ups'], 'a different name was matched anyway');
  return 'named once, and answered from her logs when it can be';
});

check('THE THREE NOTES ARE THREE DIFFERENT VOICES', () => {
  // ChatGPT, 20 October 2026, looking at this section: "Those three lines are
  // trying to do three completely different jobs... they're all written as
  // explanations of the app rather than observations about the plan."
  //
  // The observation is about HER WEEK and is the point of the section. The
  // other two are about the APP - why the drawing is incomplete, and what a
  // card in Anytime does - so they are set quieter and support it. Checked
  // because three paragraphs at one size is the state this was in, and nothing
  // in a typecheck notices a hierarchy collapsing back into a flat list.
  const section = viewRaw.slice(viewRaw.indexOf('styles.planCover'));
  assert.ok(/<ThemedText style={styles\.planNote}>/.test(section), 'the observation is no longer the loud one');
  assert.ok(/styles\.planLimit/.test(section), 'the system note is no longer set apart');
  assert.ok(/themeColor="accentDeep"[^>]*styles\.planDo/.test(section), 'the one actionable line lost its colour');
  // ACCENTDEEP, NEVER ACCENT. The theme says so in as many words: the full
  // strength terracotta is "the accent at full strength - fills, icons, large
  // type. NOT small text."
  assert.ok(
    !/type="small"\s+themeColor="accent"/.test(section),
    'small text is drawn in the full-strength accent, which does not clear AA'
  );
  // AND THE HEADING IS A HEADING. It was the same size and colour as the three
  // notes under it, which is what made the section read flat.
  assert.ok(
    /<ThemedText type="sectionTitle">If the week goes to plan<\/ThemedText>/.test(section),
    'the section title is back to being another small grey paragraph'
  );
  return 'observation, limitation, offer';
});

check('AND NO NOTE OPENS WITH A NUMBER', () => {
  // "Starting a sentence with '1' is exactly the sort of thing Selodia
  // shouldn't do. It immediately feels mechanical." It was also counting
  // something she can see for herself.
  for (const [what, text] of [
    ['the Anytime note at one', anytimeNote(1)],
    ['the Anytime note at four', anytimeNote(4)],
    ['the unknown note', unknownNote(['Rope climbing'])],
  ]) {
    assert.ok(text, `${what} says nothing`);
    assert.ok(!/^\d/.test(text), `${what} opens with a digit: "${text}"`);
  }
  assert.strictEqual(anytimeNote(0), null, 'an empty Anytime is still commented on');
  // IT OFFERS THE MOVE, and the move exists - check-week-drag covers it, so
  // this is not promising a gesture the screen does not have.
  assert.ok(/[Dd]rag/.test(anytimeNote(1)), 'the note no longer says what she can do');
  // AND IT STILL SAYS WHY, or it is an instruction with no reason behind it.
  assert.ok(/once they sit on a day/i.test(anytimeNote(1)), 'the note no longer says why Anytime is out');
  return 'no digits, and the reason kept';
});

check('IT IS MEASURED AGAINST THE SAME BAR AS A LOGGED WEEK', () => {
  // A plan judged against an easier target would call a week covered that the
  // Now flower then calls thin, and she would have no way to tell which lied.
  assert.ok(/WEEKLY_TARGET/.test(lib), 'the plan uses a target of its own');
  // Two sessions of something strong fill a dimension, same as on Now.
  const two = plannedCoverage([{ activity: 'weightlifting', days: ['mon', 'thu'] }]);
  assert.strictEqual(two.coverage.strength, 95, 'two strong sessions do not nearly fill strength');
  assert.ok(two.coverage.strength <= 100, 'coverage went past 100');
  return 'the same target, capped at 100';
});

check('IT KNOWS NOTHING ABOUT WHETHER SHE DID ANY OF IT', () => {
  // THE WHOLE RISK. The Week has no completion column and this must not become
  // one by the back door.
  // MECHANISMS, NOT ENGLISH WORDS. This used to ban the words "logged" and
  // "done" anywhere in the file, and on 20 October it started failing for the
  // right reason and the wrong cause: the copy explaining an unrecognised card
  // moved into this lib so it could be tested, and it says the word "logged"
  // to the person reading it. Banning a word in prose is not a test of what
  // code does - so what is banned now is the means of knowing: a table, a
  // query, a timestamp, a completion column.
  for (const banned of [
    /activity_logs/i,
    /happened_at/i,
    /\.from\(/,
    /completed|complete_at|done_at|ticked/i,
    /supabase/i,
  ]) {
    assert.ok(!banned.test(lib), `the plan coverage reaches for ${banned} - that is how a tick comes back`);
  }
  // And the Week screen no longer fetches the logs at all: that query went with
  // the tick, and kept running for nobody until lint found it.
  assert.ok(
    !/from\('activity_logs'\)/.test(view),
    'the Week fetches activity logs again, which is how a tick comes back'
  );
  return 'names and days, nothing else';
});

check('THE GAP NOTE NAMES AND STOPS', () => {
  const allCardio = plannedCoverage([{ activity: 'running', days: ['mon', 'wed', 'fri'] }]);
  const note = planGapNote(allCardio.coverage, label);
  assert.ok(note, 'a plan with obvious gaps says nothing');
  assert.ok(/light on/.test(note), 'it no longer names what the plan is light on');
  // NEVER A SHOULD. It is a fact about a timetable, not an instruction.
  assert.ok(
    !/should|try|add |need to|must/i.test(note),
    `the note recommends something: "${note}"`
  );
  // A covered plan says nothing rather than congratulating.
  const broad = plannedCoverage([
    { activity: 'ballet', days: ['tue'] },
    { activity: 'yoga', days: ['thu'] },
    { activity: 'running', days: ['sat'] },
    { activity: 'weightlifting', days: ['mon'] },
  ]);
  assert.strictEqual(planGapNote(broad.coverage, label), null, 'a broad plan is still commented on');
  // AN EMPTY PLAN IS NOT A GAPPY PLAN. Listing all six at nothing would be the
  // app telling somebody with no plan yet that they are failing at six things.
  assert.strictEqual(planGapNote(plannedCoverage([]).coverage, label), null, 'an empty plan is scolded');
  return `under ${THIN}, named once, no advice`;
});

check('AND THE NOT-A-SCORE LINE STILL COMES FIRST', () => {
  // That sentence is the first thing read about this screen, and a drawing
  // which fills up is exactly what it promises this screen is not.
  // THE LINE LOST ITS MARKETING HALF, 20 October 2026. Ruth: "Remove 'not a
  // score' anywhere in app thats marketing language... feels like a hard sell
  // marketing pitch." What is checked is the promise, which is the half that
  // was ever load-bearing - and it is the one a tick would break.
  const promise = viewRaw.indexOf('Nothing here is ever marked done or missed');
  const flower = viewRaw.indexOf('If the week goes to plan');
  assert.ok(promise > -1, 'the promise that nothing is marked done or missed is gone');
  assert.ok(flower > -1, 'the plan flower is gone');
  assert.ok(promise < flower, 'the flower now sits above the promise it must not contradict');
  return 'promise, then drawing';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
