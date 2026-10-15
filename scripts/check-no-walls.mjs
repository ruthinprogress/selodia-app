// A REPLY DOES NOT GO OUT AS A BLOCK OF TEXT.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-no-walls.mjs
//
// Ruth, 15 October 2026: "We really need to stop this awful block of text
// replies. I almost put the app away and give up to avoid reading such awful
// formatting." The reply she was reading was 1,020 characters with no line
// break in it - a five-exercise routine, correct in every particular, in one
// paragraph.
//
// The instruction had told the writer to lay parts out since the day before.
// It was obeyed three times that morning and ignored on the fourth, because it
// asked the model to decide whether something "has parts". So the rule moved
// to where the reply is written.
//
// WHAT IS ACTUALLY BEING PROVED HERE, and it is not the formatting. The repair
// pass is a second model call on a message that carries doses, dates, phone
// numbers and the name of a consultant. The reason it is safe to run at all is
// that it CANNOT change a word and have that survive: sameWords strips the
// markup back out and compares. Most of this file is about that comparison
// failing when it should, because a reshaping step that quietly moved a number
// would be far worse than the wall it fixed.
//
// Every message below is invented. None is Ruth's.

import assert from 'node:assert';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { looksLikeWall, longestBlock, sameWords, layoutOnly, layOut, WALL_CHARS } = await import(
  root + '/app/lib/reply-shape.ts'
);

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
async function checkAsync(name, fn) {
  try {
    const note = await fn();
    console.log(`  PASS  ${name}${note ? `   ${note}` : ''}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL  ${name}\n          ${e.message}`);
    failures.push(name);
  }
}

/** The shape she complained about: a routine, correct, in one paragraph. */
const WALL = [
  'Good timing, with the appointment coming up and the referral already in.',
  'The knee rules mean no loaded squats, no heavy deadlifts and nothing quad-heavy,',
  'so this is built around the back of the legs and the glutes.',
  'Something like this: lying dumbbell hamstring curls, single-leg glute bridges with just bodyweight,',
  'side-lying leg lifts and clamshells for the sides of the hips, and slow standing calf raises holding a dumbbell.',
  'That is two or three times a week, starting light, and the first week could be about learning the movements',
  'rather than loading them. Take it along to the appointment as well, since the plan may want changing',
  'once somebody has had a look at it. If you want it as a proper plan with sets and safety notes for each',
  'movement, it can be saved to Plans. Would you like that put together?',
].join(' ');

/** The same message, laid out. Nothing added, nothing taken away. */
const LAID_OUT = [
  'Good timing, with the appointment coming up and the referral already in.',
  'The knee rules mean no loaded squats, no heavy deadlifts and nothing quad-heavy,',
  'so this is built around the back of the legs and the glutes.',
  '',
  'Something like this:',
  '- lying dumbbell hamstring curls,',
  '- single-leg glute bridges with just bodyweight,',
  '- side-lying leg lifts and clamshells for the sides of the hips,',
  '- and slow standing calf raises holding a dumbbell.',
  '',
  'That is two or three times a week, starting light, and the first week could be about learning the movements',
  'rather than loading them. Take it along to the appointment as well, since the plan may want changing',
  'once somebody has had a look at it.',
  '',
  'If you want it as a proper plan with sets and safety notes for each',
  'movement, it can be saved to Plans. Would you like that put together?',
].join('\n');

console.log('\n  NO WALLS OF TEXT\n');

check('the message she complained about is detected', () => {
  assert.ok(WALL.length > 800, 'the sample is not the size of the one she read');
  assert.ok(looksLikeWall(WALL), 'a 900-character paragraph is not read as a wall');
  return `${longestBlock(WALL)} characters in one block`;
});

check('an ordinary short reply is left alone', () => {
  // Her own replies of that morning, by length: 273 and 326 characters in one
  // paragraph each, and neither is a wall. The guard must not fire on these.
  const short =
    'That is already in Plans under the name you gave it, with all five movements and the ' +
    'starting weights, so it will be there when you want to look at it on the day. Nothing ' +
    'else needs doing before then.';
  assert.ok(short.length > 180, 'the sample is too short to prove anything');
  assert.ok(!looksLikeWall(short), 'a normal paragraph was read as a wall');
  return `${longestBlock(short)} characters, left alone`;
});

check('a long reply that is already laid out is left alone', () => {
  assert.ok(LAID_OUT.length > 800, 'the laid-out sample is not long');
  assert.ok(!looksLikeWall(LAID_OUT), 'a long but broken-up reply was treated as a wall');
  return `${longestBlock(LAID_OUT)} characters in its longest block`;
});

check('the threshold is where the measurement put it', () => {
  assert.strictEqual(WALL_CHARS, 400);
  assert.ok(!looksLikeWall('x'.repeat(WALL_CHARS)), 'the threshold is off by one on the low side');
  assert.ok(looksLikeWall('x'.repeat(WALL_CHARS + 1)), 'the threshold is off by one on the high side');
  return 'fires above 400 characters, not at it';
});

console.log('\n  AND THE REPAIR CANNOT CHANGE WHAT IT SAYS\n');

check('layout alone is recognised as layout alone', () => {
  assert.ok(sameWords(WALL, LAID_OUT), 'breaking a message into lines was read as changing it');
  return 'lines, dashes and blank lines all ignored';
});

check('a label added in double asterisks is allowed', () => {
  // Permitted because the check strips the asterisks - the WORDS still have to
  // match, so a label can only reuse words already in the message.
  const withLabel = LAID_OUT.replace('Something like this:', '**Something like this:**');
  assert.ok(sameWords(WALL, withLabel), 'a bold label broke the comparison');
  return 'asterisks stripped, words still compared';
});

check('A CHANGED NUMBER IS CAUGHT', () => {
  // The reason the repair is allowed to run at all.
  const movedNumber = LAID_OUT.replace('two or three times a week', 'four or five times a week');
  assert.notStrictEqual(movedNumber, LAID_OUT, 'the sample did not actually change');
  assert.ok(!sameWords(WALL, movedNumber), 'a reshaping step could change how often she trains');
  return 'a rewritten frequency is rejected';
});

check('a digit changed inside a word is caught', () => {
  const before = 'Take 20mg in the morning and ring 0800 000 001 if it gets worse.';
  const after = 'Take 25mg in the morning and ring 0800 000 001 if it gets worse.';
  assert.ok(!sameWords(before, after), 'a changed dose survived the comparison');
  const phone = 'Take 20mg in the morning and ring 0800 000 002 if it gets worse.';
  assert.ok(!sameWords(before, phone), 'a changed phone number survived the comparison');
  return 'dose and telephone number both rejected';
});

check('a dropped sentence is caught', () => {
  const trimmed = LAID_OUT.replace('- side-lying leg lifts and clamshells for the sides of the hips,\n', '');
  assert.ok(!sameWords(WALL, trimmed), 'a reshaping step could silently drop an exercise');
  return 'a missing line is rejected';
});

check('a trailing comma dropped from a bullet is allowed', () => {
  // THE ONE CONCESSION, and it is the difference between a repair that costs
  // 2 seconds and one that costs 9. Measured: Haiku and Sonnet both laid the
  // real message out correctly and both dropped exactly this comma.
  const noComma = LAID_OUT.replace('- lying dumbbell hamstring curls,', '- lying dumbbell hamstring curls');
  assert.notStrictEqual(noComma, LAID_OUT, 'the sample did not change');
  assert.ok(sameWords(WALL, noComma), 'a list item losing its comma was treated as a rewrite');
  return 'a list item need not end in a comma';
});

check('but a comma inside a number is not touched', () => {
  const before = 'The excess is 1,000 pounds and the claim line is open until six.';
  const after = 'The excess is 1000 pounds and the claim line is open until six.';
  assert.ok(!sameWords(before, after), 'a number lost its comma and the comparison allowed it');
  return '1,000 cannot quietly become 1000';
});

check('a lost full stop is still caught', () => {
  const run = LAID_OUT.replace('loading them. Take it along', 'loading them Take it along');
  assert.ok(!sameWords(WALL, run), 'two sentences were merged and the comparison allowed it');
  return 'only the comma was relaxed';
});

check('and this check can fail', () => {
  // THE WEAKER COMPARISON THIS REPLACES. Checking that nothing has been lost -
  // same length, or the same first and last line - passes every one of the
  // cases above, which is how a reshaping step gets away with moving a dose.
  const movedNumber = LAID_OUT.replace('two or three times a week', 'four or five times a week');
  const naive = (a, b) => a.length === b.length;
  assert.strictEqual(naive(LAID_OUT, movedNumber), true, 'the weaker check already rejects this');
  assert.strictEqual(sameWords(WALL, movedNumber), false);
  return 'a same-length check passes the changed number; this one does not';
});

console.log('\n  AND THE LAYOUT STEP ITSELF\n');

check('the wall she complained about is broken up', () => {
  const out = layOut(WALL);
  assert.notStrictEqual(out, WALL, 'the wall was left as it was');
  assert.ok(!looksLikeWall(out), `still a wall at ${longestBlock(out)} characters`);
  assert.ok(sameWords(WALL, out), 'the layout step changed what the reply says');
  return `${longestBlock(WALL)} -> ${longestBlock(out)} characters`;
});

check('the five exercises come out as five lines', () => {
  const out = layOut(WALL);
  const bullets = out.split('\n').filter((line) => line.startsWith('- '));
  assert.strictEqual(bullets.length, 4, `got ${bullets.length} lines, not the four items`);
  assert.ok(/^Something like this:$/m.test(out), 'the lead-in did not get its own line');
  return 'a colon and four items became a lead-in and four lines';
});

check('THE LAST ITEM KEEPS ITS FULL STOP', () => {
  // The bug that made the first version of this do nothing at all: the list
  // builder tidied the full stop off the last item, so the laid-out reply
  // differed from the original by one character, sameWords refused the whole
  // thing, and the wall went out anyway. The guard was right and the layout
  // was wrong.
  const out = layOut(WALL);
  const bullets = out.split('\n').filter((line) => line.startsWith('- '));
  assert.ok(bullets[bullets.length - 1].endsWith('.'), 'the last list item lost its full stop');
  return 'nothing is tidied, not even a full stop';
});

check('a short reply is returned untouched, the same object', () => {
  const short = 'That is in Plans now, under the name you gave it.';
  assert.strictEqual(layOut(short), short);
  return 'no work done below the threshold';
});

check('an already laid-out reply is left exactly as it is', () => {
  assert.strictEqual(layOut(LAID_OUT), LAID_OUT, 'a reply that was already fine got rearranged');
  return 'the writer’s own layout is never overridden';
});

check('a long single sentence is left alone rather than butchered', () => {
  // Nothing can break this without changing words, and changing words is the
  // one thing forbidden. Four of her twelve recent walls are this shape; they
  // are the writer's to fix, which is what the sixty-word rule is for.
  const one =
    'The claim line will want the authorisation number and the date of the first appointment ' +
    'before they will talk about the excess at all, and they will ask whether the referral came ' +
    'from a general practitioner or from the consultant directly, which changes which of the two ' +
    'policies it is paid from and therefore how long it takes for any of it to come back to you ' +
    'in writing rather than over the telephone, which is the only version anybody will act on.';
  assert.ok(looksLikeWall(one), 'the sample is not long enough to be a wall');
  assert.strictEqual(layOut(one), one, 'a single sentence was split anyway');
  return 'one sentence stays one sentence';
});

check('a title before a surname does not end a line', () => {
  const withTitles =
    'Dr Okonjo wrote on the 4th that the swelling had settled, which is the line worth quoting. ' +
    'Mr Vasquez is the one you are seeing on the 27th, and he is the one who can order the scan. ' +
    'Take the letter with you, because the date on it is what makes the request hard to refuse ' +
    'and it saves you describing the whole history again from the beginning in the appointment.';
  const out = layOut(withTitles);
  assert.ok(sameWords(withTitles, out), 'the layout changed the words');
  for (const line of out.split('\n')) {
    assert.ok(!/\b(?:Dr|Mr|Mrs|Ms)$/.test(line.trim()), `a line ended on a title: "${line.trim()}"`);
  }
  return 'Dr and Mr stay with their surnames';
});

check('a colon in ordinary prose is not turned into a list', () => {
  const prose =
    'Here is the thing: the referral is already in, so the appointment is not the problem. ' +
    'The problem is the authorisation, which has to come from the insurer first, and they ' +
    'will not start it until somebody gives them the policy number over the telephone. ' +
    'That is the call to make, and it is the only thing standing between you and a date.';
  const out = layOut(prose);
  assert.ok(!out.includes('\n- '), 'prose containing a colon was turned into bullets');
  assert.ok(sameWords(prose, out), 'the layout changed the words');
  return 'only a genuine run of items becomes lines';
});

check('and the layout step can fail', () => {
  // If layOut could return anything at all, every check above would pass on a
  // function that returns its input. This proves it does real work, and that
  // the safety net underneath it is load-bearing rather than decorative.
  assert.notStrictEqual(layOut(WALL), WALL, 'layOut is a no-op and the checks above prove nothing');
  const sabotaged = layOut(WALL).replace('two or three times a week', 'four or five times a week');
  assert.strictEqual(
    sameWords(WALL, sabotaged),
    false,
    'the net under layOut does not catch a changed number'
  );
  return 'it changes the layout, and a changed word would still be caught';
});

console.log('\n  AND THE WRITER IS STILL TOLD, SO THE GUARD RARELY FIRES\n');

await checkAsync('the instruction gives a countable rule, not a judgement', async () => {
  const { readFileSync } = await import('node:fs');
  const lead = readFileSync('app/lib/lead-turn.ts', 'utf8');
  assert.ok(/NO PARAGRAPH OVER SIXTY WORDS/.test(lead), 'the paragraph limit is not stated as a number');
  assert.ok(/THREE OR MORE THINGS MEANS LINES/.test(lead), 'the list trigger is not stated as a count');
  assert.ok(
    !/Anything with PARTS gets a shape/.test(lead),
    'the old judgement-based wording is still there, and it is what failed'
  );
  return 'sixty words, three things';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
