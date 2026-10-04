// CAN WALKING THROUGH SETUP AGAIN DESTROY SOMETHING SHE DID NOT TOUCH?
//
//   node scripts/check-setup-destroys-nothing.mjs
//
// On 1 October 2026 Ruth opened "redo my setup" to review the wording, walked to
// the activities screen and pressed Continue. **Her entire week was deleted** -
// Gym on Wednesdays and the French class on Thursday, both of which she had added
// through chat four hours earlier. Nothing was written in their place.
//
// The code did this:
//
//   // Only the rows onboarding put there are replaced. Anything added later in
//   // chat is hers and is not this screen's to remove.
//   await supabase.from('user_week').delete().eq('user_id', user.id);
//   if (chosen.length === 0) return true;
//
// A comment describing an intention nobody implemented, sitting directly above
// the line that does the opposite - and a delete that runs BEFORE the early
// return, so the "I changed nothing" path was the destructive one.
//
// WHY A SOURCE CHECK. The failure is a DELETE with too wide a filter, which no
// unit test on this screen's logic would see: the logic was right, the scope was
// not. What can be checked mechanically is the shape - that no setup screen
// deletes every row a person owns, and that a destructive call never sits above
// the guard that decides whether to be destructive at all.
//
// It is weak evidence about behaviour and strong evidence about a rule holding
// across a folder that will grow. The real proof is the live test below it.

import fs from 'node:fs';
import path from 'node:path';

const DIR = 'mobile/src/app/onboarding';

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

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.tsx'));
console.log('\n  SETUP DESTROYS NOTHING SHE DID NOT TOUCH\n');

// ---- 1. no screen wipes a whole table for a user -------------------------
check('no setup screen deletes every row a person owns', () => {
  // THE FILTER IS THE WHOLE QUESTION, so the chain is read rather than pattern-
  // matched. The first version of this flagged any `.delete().eq('user_id'...)`
  // and so condemned goals.tsx and skill.tsx, both of which are correct: goals
  // narrows to `source = 'onboarding'` and skill to one `ladder_key`. A check
  // that cries wolf on correct code gets switched off, and then it is not there
  // for the one case that matters.
  const offenders = [];
  for (const f of files) {
    // COMMENTS ARE NOT CODE, and this check could not tell. activities.tsx now
    // carries a note QUOTING the delete that cost Ruth her week, so the file
    // that was fixed was the only one still failing - and the files most likely
    // to describe a bug are the ones that just fixed it. Stripped first.
    const src = fs
      .readFileSync(path.join(DIR, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    let at = src.indexOf('.delete()');
    while (at >= 0) {
      // The chained filters, up to the end of the statement.
      const end = src.indexOf(';', at);
      const chain = src.slice(at, end < 0 ? at + 400 : end);
      const filters = [...chain.matchAll(/\.(?:eq|in|neq|is|match|filter)\(\s*['"]?(\w+)/g)].map(
        (m) => m[1]
      );
      const scopedOnlyToUser =
        filters.length > 0 && filters.every((name) => name === 'user_id');
      if (scopedOnlyToUser) offenders.push(`${f} (filters: ${filters.join(', ')})`);
      at = src.indexOf('.delete()', at + 1);
    }
  }
  ok(
    offenders.length === 0,
    `${offenders.join('; ')} — deletes every row for the user. A setup screen may ` +
      'only remove rows IT created; anything else in there came from chat and is hers.'
  );
  return `${files.length} screens, every delete scoped to more than the user`;
});

// ---- 2. the activities screen specifically -------------------------------
const activities = fs.readFileSync(path.join(DIR, 'activities.tsx'), 'utf8');

check('a blank screen cannot be read as "she deselected everything"', () => {
  // THIS CHECK USED TO PASS ON THE BUG IT WAS WRITTEN FOR (2 October 2026).
  //
  // It asserted the ordering of the delete against the "nothing chosen" early
  // return, and then ended in `|| activities.slice(0, guard).includes('toRemove')`
  // - an exception for precisely the shape the file had. So the delete stayed
  // above the guard, the no-op walk stayed destructive, and the check reported
  // "the no-op walk is a no-op" every time it ran.
  //
  // A CHECK WITH AN EXCEPTION FOR THE CURRENT CODE IS NOT A CHECK. It cannot
  // fail, so it carries no information; worse, it reads in a report as evidence.
  //
  // The ordering was never the property anyway. What matters is that the screen
  // cannot act on `chosen` before it knows what her week holds: the delete may
  // sit wherever it likes once an empty selection is genuinely her answer. So
  // this now reads the two lines that make that true.
  // THE GUARANTEE IS UNCHANGED; THE MECHANISM WAS RENAMED ON 2 OCTOBER.
  //
  // This used to assert a `loaded` boolean. That boolean could not tell "not yet"
  // from "it failed", and the failed case inherited the treatment built for the
  // first: a blank screen with a dead Continue and no message, which is half of
  // why two days of work looked broken to Ruth. It is now a three-state
  // LoadState - see lib/load-state.ts.
  //
  // WHAT MUST STILL HOLD, and is what these assert: an empty chip row may never be
  // read as "she deselected everything" unless her week was actually read. The
  // screen no longer traps her when the read fails, and it still does not write.
  ok(
    /const \[loadState, setLoadState\] = useState<LoadState>\('loading'\)/.test(activities),
    'the screen does not track whether it has read her week yet, so an empty ' +
      'selection is indistinguishable from an unloaded screen'
  );
  // THE REFUSAL IS THE PROPERTY; `return true` WAS THE BUG (2026-10-04).
  //
  // This asserted the exact line `if (!mayWrite(loadState)) return true;` - and
  // that `true` is what sent Ruth back to her profile believing her week had
  // saved when the screen had deliberately written nothing. "From Profile,
  // filled in 'What you already do' but nothing was populated anywhere in week."
  //
  // save() now returns an outcome rather than a boolean, so the refusal says
  // which refusal it was and the screen tells her. What must still hold - and
  // what this now reads - is that nothing past the gate runs when the week is
  // not in hand.
  ok(
    /if \(!mayWrite\(loadState\)\) \{/.test(activities),
    'save() does not refuse to run before her week has been read - a slow read ' +
      'plus a quick Continue deletes every activity this screen knows about'
  );
  ok(
    !/if \(!mayWrite\(loadState\)\) return true;/.test(activities),
    'the refusal reports SUCCESS to its caller, so she is moved on and told ' +
      'nothing - which is indistinguishable from a save that worked'
  );
  ok(
    /return 'not-ready';/.test(activities),
    'the refusal does not name itself, so the screen cannot tell her which of ' +
      '"nothing saved" and "nothing chosen" happened'
  );
  ok(
    /loaded: mayWrite\(loadState\)/.test(activities),
    'the write plan is not told whether her week was read, so its refusal - the ' +
      'thing check-week-write-plan.mjs case 1 and 2 rely on - never triggers'
  );
  ok(
    /if \(weekError\) \{\s*setLoadState\('failed'\);/.test(activities),
    'a failed read does not mark the screen failed, so a network error presents ' +
      'as "she unselected all of them"'
  );
  ok(
    /enabled: mayContinue\(loadState, saving\)/.test(activities),
    'Continue is not gated on the read settling'
  );
  return 'loading, failed and ready are three different states';
});

check('the screen shows her current week selected', () => {
  // Item 4: redo is an edit mode. This is also what makes the check above true,
  // so it is not a separate nicety - a screen that displays her selection is a
  // screen whose empty state means something.
  ok(
    /from\('user_week'\)\s*\.select\('activity, cadence'\)/.test(activities),
    'the screen never reads her week, so a redo starts blank and overwrites'
  );
  ok(/setChosen\(picked\)/.test(activities), 'the rows that were read are not shown as selected');
  return 'a redo opens on her answers';
});

// ---- 2b. the goals screen, which did it a second time -------------------
const goals = fs
  .readFileSync(path.join(DIR, 'goals.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

check('the goals screen archives nothing when nothing is chosen', () => {
  // IT HAPPENED TWICE IN TWO DAYS, WHICH IS WHY THIS IS A CHECK AND NOT A NOTE.
  //
  // 1 October: the activities screen deleted her week on a walk-through with no
  // chip tapped. 2 October, 18:56: the goals screen archived her goal on a
  // walk-through with no chip tapped, and inserted nothing - because the archive
  // was unconditional while the insert sat behind `chosen.length > 0`. Her Body
  // Manual read "none yet" a minute later.
  //
  // Between those two I widened this archive from `source = 'onboarding'` to every
  // active goal, which is exactly when the guard mattered most, and did not carry
  // it across. A diagnosis written in a commit message protects nothing.
  const archiveAt = goals.indexOf('archived_at: archivedAt');
  ok(archiveAt > 0, 'the goals screen no longer archives anything - has it been rewritten?');

  const before = goals.slice(0, archiveAt);
  ok(
    /if \(chosen\.length > 0\) \{/.test(before),
    'the archive is not inside a "something was chosen" guard, so walking this ' +
      'screen and touching nothing removes every goal she has and replaces none'
  );
  return 'an untouched walk leaves her goals alone';
});

check('and it does not blank her focus either', () => {
  // THE OTHER HALF OF THE SAME WIPE. focusFromGoals([]) returns {null, null}, and
  // writing that over a focus she already had removes her calorie target - the
  // same destruction, one table across.
  const updateAt = goals.indexOf('fat_focus_state: fat');
  ok(updateAt > 0, 'the goals screen no longer writes the focus - has it been rewritten?');
  ok(
    /if \(chosen\.length === 0\) return true;/.test(goals.slice(0, updateAt)),
    'nothing chosen still writes null over her focus states, which erases the ' +
      'calorie target she already had'
  );
  return 'her targets survive an untouched walk';
});

check('the screen uses the plan the behaviour test exercises', () => {
  // WITHOUT THIS, check-week-write-plan.mjs PROVES NOTHING ABOUT THE APP. A pure
  // function with twelve passing cases that no screen calls is the pattern this
  // codebase keeps hitting: collected, stored, and read by nobody. The test is
  // evidence only while this line holds.
  ok(
    /planWeekWrite\(\{/.test(activities),
    'the screen has its own copy of the merge logic, so check-week-write-plan.mjs ' +
      'tests code that never runs on her phone'
  );
  ok(
    /\.delete\(\)\.in\('id', plan\.remove\)/.test(activities),
    'the delete is not driven by the plan, so the twelve tested cases do not ' +
      'constrain what actually gets removed'
  );
  return 'the tested function is the one that runs';
});

// The scoping lives in the plan module now, which is where it can be run against
// every subset of the chips rather than pattern-matched. These three read it
// there; `check-week-write-plan.mjs` is what actually constrains the behaviour.
const plan = fs.readFileSync('mobile/src/lib/week-write-plan.ts', 'utf8');

check('it can only remove its own activities', () => {
  ok(
    /own\.has\(r\.activity\) && !keep\.has\(r\.activity\)/.test(plan),
    "the removal is not scoped to this screen's own ten activities, so a French " +
      'class added in chat can be swept up by a setup redo'
  );
  return 'scoped to the ten chips (case 5 tries all 8 subsets)';
});

check('an activity she keeps is updated, not re-made', () => {
  // A delete-and-reinsert loses days_chosen_at and time_of_day - her Wednesday
  // and her 10am - which is a quieter version of the same loss.
  ok(
    /updateCadence = existing/.test(plan),
    'nothing updates a kept row in place'
  );
  ok(
    /insert = chosen\s*\n\s*\.filter\(\(c\) => !present\.has\(c\.activity\)\)/.test(plan),
    're-selecting an activity re-creates the row, which throws away the day she ' +
      'chose and the time she gave'
  );
  return 'her day and time survive (case 9)';
});

// ---- 3. the comment that lied --------------------------------------------
check('no comment claims a scope the code does not have', () => {
  // Narrow on purpose: this exact sentence sat above a wipe for days.
  const claims = /Only the rows onboarding put there are replaced/.test(activities);
  const scoped = /own\.has\(r\.activity\)/.test(plan);
  ok(!claims || scoped, 'the comment claims onboarding only replaces its own rows; the code does not');
  return 'the comment and the code agree';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
