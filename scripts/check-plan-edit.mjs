// CHANGING A PLAN CHANGES IT. IT DOES NOT MAKE A SECOND ONE.
//
//   node scripts/check-plan-edit.mjs
//
// Ruth, 20 October 2026, after asking to add three movements to yesterday's
// ballet plan:
//
//   "It said it couldn't add the quad excersises, I insisted, it duplicated
//    instead of added, offered to dekete one, then it said it couldn't tell
//    them apart. It was logical to remove them one before the additions. Some
//    illogical reasoning there putting the work onto the user, not good. But
//    thete should never have been a duplicate in the first place"
//
// Three faults stacked, and she named the root one herself.
//
// THE DUPLICATE. almanac.ts already refuses to write the same plan twice, but
// only inside a ten-minute window - deliberately, so that deliberately saving a
// fresh version next week is a new entry. An EDIT happens whenever she thinks
// of it, and hers was a day later, so the save fell through to the insert.
// There WAS a route - a conversation anchored to a plan saves as an edit of it
// - but it needed her to have tapped into the plan first. Naming it in words
// reached nothing.
//
// THE REFUSAL. Two plans then shared a title and differed, so removal refused
// and asked her which. That rule is right - picking between two plans that
// share a name loses work somebody wrote - and it was useless, because there
// was no way for her to ANSWER it. She knew which one. The app had no field for
// her to say so.

import assert from 'node:assert';
import fs from 'node:fs';

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

const route = fs.readFileSync('app/api/ask-selodia/route.ts', 'utf8');
const removal = fs.readFileSync('app/lib/plan-removal.ts', 'utf8');

console.log('\n  AN EDIT REPLACES, IT DOES NOT ADD\n');

check('THE MODEL CAN SAY WHICH PLAN IT IS EDITING', () => {
  assert.ok(/editsPlanTitled: \{/.test(route), 'there is no way to say a save is an edit');
  assert.ok(/editsPlanTitled\?: string;/.test(route), 'it never reaches the handler');
  const at = route.indexOf('editsPlanTitled: {');
  const field = route.slice(at, at + 1400);
  // The field is useless unless the model sends the WHOLE plan, or the edit
  // silently drops everything it did not mention.
  assert.ok(
    /AS IT SHOULD NOW READ, in full, including everything that is staying/.test(field),
    'nothing tells the model to send the whole plan, so an edit would delete the rest of it'
  );
  assert.ok(
    /WITHOUT THIS A SECOND COPY IS CREATED/.test(field),
    'the consequence of omitting it is not stated'
  );
  return 'field, type, and the whole-plan instruction';
});

check('AND THE SAVE REPLACES THAT PLAN RATHER THAN ADDING ONE', () => {
  assert.ok(/findPlanToEdit/.test(route), 'the named plan is never looked up');
  assert.ok(/let editedPlanId: string \| null = null;/.test(route), 'no id is carried to the save');
  assert.ok(
    /editedPlanId \?\? \(provisionalTag\?\.entryType === 'plan'/.test(route),
    'the resolved plan id is not passed to saveAlmanacEntry, so it still inserts'
  );
  // The anchored-conversation route must survive: it is how an edit works when
  // she tapped into the plan rather than naming it.
  assert.ok(
    /provisionalTag\.entryId/.test(route),
    'the anchored-conversation edit route was removed along with the bug'
  );
  return 'named plan first, anchored plan still the fallback';
});

check('TWO PLANS SHARING A NAME ARE NEVER EDITED AT RANDOM', () => {
  assert.ok(/reason: 'ambiguous'/.test(removal), 'ambiguity is no longer detected');
  const at = route.indexOf("target.reason === 'ambiguous'");
  assert.ok(at > -1, 'the route does not handle the ambiguous case');
  const body = route.slice(at, at + 900);
  // NOTHING MAY BE SAVED in that case, or she gets a third copy of a plan she
  // already has two of - the exact fault this change exists to stop.
  assert.ok(
    /result\.almanacKind = undefined;/.test(body),
    'an ambiguous edit still saves, which adds a third copy'
  );
  assert.ok(/movements/.test(body), 'the candidates are not described back to her');
  return 'refused, nothing saved, and the candidates named';
});

check('and the refusal actually reaches her', () => {
  // The reply was written before the lookup ran, so without this she is told
  // the change landed while nothing was saved at all.
  assert.ok(/planEditNote,/.test(route), 'the refusal is computed and never said');
  const notesAt = route.indexOf('ruleRemovalNote,\n');
  assert.ok(notesAt > -1 && route.indexOf('planEditNote,') > notesAt, 'it is not in the note list');
  return 'in the same list as every other app note';
});

check('A REMOVAL CAN BE ANSWERED, NOT JUST REFUSED', () => {
  // Her words: "it said it couldn't tell them apart... putting the work onto
  // the user". The refusal was right and unanswerable.
  assert.ok(/removePlanSavedOn: \{/.test(route), 'there is no way to say which copy she means');
  assert.ok(/savedOn\?: string \| null/.test(removal), 'the date never reaches the remover');
  assert.ok(
    /r\.created_at\.slice\(0, 10\) === savedOn/.test(removal),
    'the date is accepted and not used to narrow'
  );
  // It must narrow BEFORE the identical-content rule, because a date she gave
  // is a direct answer and that rule is an inference.
  const dateAt = removal.indexOf('=== savedOn');
  const sameAt = removal.indexOf('const allSame');
  assert.ok(dateAt > -1 && sameAt > dateAt, 'the date is applied after the content inference');
  // And only when it picks out exactly one.
  assert.ok(/onThatDay\.length === 1/.test(removal), 'a date matching two plans still removes one');
  return 'narrowed by date, before the inference, only when unique';
});

check('AND NOTHING IS REMOVED WHEN SHE HAS NOT SAID WHICH', () => {
  // The protection that was right all along, kept intact.
  assert.ok(
    /if \(!allSame\) return \{ done: false, reason: 'ambiguous'/.test(removal),
    'two different plans sharing a name are now deleted on a guess'
  );
  return 'still refuses without an answer';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
