// AFTER FINISH: THE MOMENT, AND THE THREE THINGS THAT MAKE IT SAFE.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-welcome.mjs
//
// Ruth, 5 October 2026: "After Finish: the screen fades to terracotta; the seed
// mark fades in and gently pulses; 'Welcome to Selodía' and 'Understand your
// body. Live in it.'; the seed pulses once more; the app opens on the Body
// Manual."
//
// WHY A SCREEN LIKE THIS NEEDS A CHECK AT ALL. It is the only screen in the app
// whose exit is a timer. Everything else leaves because somebody tapped
// something, so "can she get out of here" answers itself; here it is a promise
// made by code that may not run. Three ways it can fail to run, all of them
// ordinary: reduce motion is on and the timeline never starts, the app is
// backgrounded mid-sequence and the animation's completion callback never
// fires, or a frame drops on an older phone.
//
// So the cases below are not about how it looks. They are about whether anybody
// can be stuck on it.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const W = await import(root + '/mobile/src/lib/welcome.ts');
const BRAND = await import(root + '/mobile/src/lib/brand.ts');

const screen = readFileSync('mobile/src/app/onboarding/welcome.tsx', 'utf8');
const code = screen.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/[^\n]*/g, '');
const lifeStage = readFileSync('mobile/src/app/onboarding/life-stage.tsx', 'utf8');
const finish = readFileSync('mobile/src/lib/finish-setup.ts', 'utf8');

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

console.log('\n  AFTER FINISH\n');

// ------------------------------------------------------------- her words

check('her two lines, as she wrote them', () => {
  assert.strictEqual(W.WELCOME.title, 'Welcome to Selodía');
  // THE TAGLINE MOVED AND THIS CASE WAS PINNED TO THE WRONG ONE (6 October
  // 2026). I wrote "Understand your body. Live in it." into her brief, she took
  // it, and the real tagline has been CONFIRMED FINAL in the spec since 31
  // August. The assertion is against the spec now, through lib/brand.ts, so this
  // cannot be the thing that keeps a wrong line alive. See check-brand.mjs.
  assert.strictEqual(W.WELCOME.line, BRAND.TAGLINE);
  return `"${W.WELCOME.title}" / "${W.WELCOME.line}"`;
});

check('the waiting message is hers, word for word', () => {
  assert.strictEqual(
    W.WELCOME_MESSAGE,
    "Welcome to Selodía. Everything you've shared is a starting point, not a commitment. " +
      'As life changes, simply say so in chat and your guide will change with you. ' +
      'How are you doing today?'
  );
  return 'one message, already there when she taps Chat';
});

// --------------------------------------------- nobody can be stuck on it

check('there is time to read it, and it still ends', () => {
  // THE CAP WAS MINE AND SHE MOVED IT (6 October 2026). Six seconds was my
  // judgement about how long is too long, made before the tagline became two
  // lines, and she watched it: "it doesn't feel like it has enough time to be
  // read fully and feel like a moment."
  //
  // WHAT THE NUMBER IS NOW FOR. Not "is it short enough" but "is there time to
  // read it" - so the assertion is on the words being up long enough, with a
  // ceiling that is now about patience rather than about my guess.
  const wordsUpFor = W.WELCOME_TIMING.secondPulse + W.WELCOME_TIMING.rest;
  assert.ok(
    wordsUpFor >= 3000,
    `${wordsUpFor}ms to read four lines is not a moment, it is a flash`
  );
  assert.ok(
    W.WELCOME_TOTAL_MS <= 9000,
    `${W.WELCOME_TOTAL_MS}ms is long to hold somebody on a screen with nothing to do`
  );
  assert.ok(W.WELCOME_REDUCED_MS < W.WELCOME_TOTAL_MS, 'reduce motion is not quicker');
  return `${(W.WELCOME_TOTAL_MS / 1000).toFixed(1)}s, or ${(W.WELCOME_REDUCED_MS / 1000).toFixed(1)}s with reduce motion`;
});

check('a plain timer owns the exit, not the animation', () => {
  // THE ONE THAT MATTERS. Animated.sequence's completion callback does not fire
  // if the app is backgrounded mid-sequence; setTimeout does. A screen that
  // navigates from the callback strands anybody who looks away for ten seconds.
  assert.ok(/setTimeout\(leave/.test(code), 'the exit is not on a timer');
  assert.ok(
    !/\.start\(\s*\(\s*\)\s*=>/.test(code),
    'the animation has a completion callback, which is where the exit used to hide'
  );
  return 'setTimeout, which fires in the background';
});

check('any tap ends it, and the screen says so', () => {
  assert.ok(/onPress=\{leave\}/.test(code), 'the screen is not tappable');
  assert.ok(/accessibilityRole="button"/.test(code), 'it is not announced as something to press');
  assert.ok(W.WELCOME.skip.length > 0, 'there is no visible way past it');
  assert.ok(
    screen.includes('WELCOME.skip'),
    'the way past it is never drawn, so it is undiscoverable'
  );
  return `"${W.WELCOME.skip}", said on the screen`;
});

check('reduce motion gets the words and leaves', () => {
  assert.ok(/isReduceMotionEnabled/.test(code), 'it does not ask');
  assert.ok(
    /setReduceMotion\(true\)/.test(code),
    'a failed read does not fall back to holding still, so it animates at somebody on a maybe'
  );
  assert.ok(
    /WELCOME_REDUCED_MS/.test(code),
    'reduce motion has no exit of its own, so it would sit on the first frame for ever'
  );
  return 'still, readable, and it still ends';
});

check('it cannot leave twice', () => {
  // A tap landing a frame before the timer would otherwise fire two navigations.
  assert.ok(/left\.current/.test(code), 'nothing guards a double exit');
  return 'a ref, checked before navigating';
});

check('it replaces rather than pushes', () => {
  assert.ok(/router\.replace/.test(code), 'it does not replace');
  assert.ok(!/router\.push/.test(code), 'a back gesture can return to a finished welcome');
  assert.strictEqual(W.AFTER_WELCOME_ROUTE, '/settings/body-manual');
  return 'and it lands on the Body Manual';
});

// ------------------------------------------------------ finishing is once

check('the last question finishes setup', () => {
  assert.ok(/finishSetup/.test(lifeStage), 'the last question does not finish anything');
  assert.ok(/'Finish'/.test(lifeStage), 'the button does not say Finish');
  assert.ok(
    /onboarding\/welcome/.test(lifeStage),
    'finishing does not reach the welcome'
  );
  // AND A ONE-QUESTION TRIP IS NOT FINISHING. Editing her hormones from the Body
  // Manual must not re-welcome her.
  assert.ok(
    /fromManual/.test(lifeStage),
    'a one-question trip from the Manual is treated as finishing setup'
  );
  return 'Finish, and only when she is actually finishing';
});

check('the greeting is written once, by the app', () => {
  assert.ok(/welcome_seen_at/.test(finish), 'nothing records that she has been welcomed');
  assert.ok(
    /from\('chat_messages'\)/.test(finish),
    'the app does not place the message, so the model would have to'
  );
  assert.ok(
    /alreadyWelcomed/.test(finish),
    'nothing stops a second Finish posting a second identical greeting'
  );
  // A FAILED READ MUST NOT WRITE. A duplicate greeting is the app visibly losing
  // track of itself; a missing one is a gap.
  assert.ok(
    /could not read welcome_seen_at[\s\S]{0,200}return/.test(finish),
    'a failed read falls through to writing the greeting anyway'
  );
  return 'read, then write, then stamp';
});

check('the seed on the Manual goes once it is used', () => {
  const manual = readFileSync('mobile/src/components/body-manual.tsx', 'utf8');
  assert.ok(/markChatOpened/.test(manual), 'tapping the seed does not record that she has');
  assert.ok(/chat_first_opened_at/.test(manual), 'the seed does not know whether she has been');
  assert.ok(/WELCOME_SEED/.test(manual), 'the seed has no words, so it is the only cue');
  return 'and it is never the only cue';
});

// --------------------------------------------------------- the draft is gone

check('the first draft is gone, and nobody is sent back to question one', () => {
  const step = readFileSync('mobile/src/lib/onboarding-step.ts', 'utf8');
  // THE ONE TRAP IN REMOVING IT. resumeRoute falls back to the FIRST screen for
  // an unknown stored step, so anybody sitting on 'first_draft' - which means
  // every question answered - would be walked through setup again.
  assert.ok(/first_draft: 'complete'/.test(step), 'a stored first_draft resumes at question one');
  return 'first_draft reads as complete';
});

check('it can be reached on purpose, not only by finishing', () => {
  // THE ONE THAT WAS MISSING, AND IT IS THE REASON ALL OF THIS SHIPPED
  // UNREACHABLE. Every case above tested the sequence. None tested that anybody
  // could get to it. I offered "Redo setup replays it", she chose it, and Redo
  // setup has not existed since 2 October - she had it deleted after it deleted
  // her week.
  const more = readFileSync('mobile/src/app/settings/index.tsx', 'utf8');
  assert.ok(
    /onboarding\/welcome/.test(more),
    'nothing in More reaches the welcome, so it plays once and can never be looked at'
  );
  assert.ok(
    !/Redo my setup|redoSetup/.test(more),
    'the redo is back, and it is the thing she had removed on 2 October'
  );
  const screen = readFileSync('mobile/src/app/onboarding/welcome.tsx', 'utf8');
  assert.ok(/replay/.test(screen), 'a replay ends in the Body Manual as though she had just finished');
  return 'a row in More, and a replay goes back where it came from';
});

check('and this check can fail', () => {
  // The version that navigates from the animation's callback, which is the shape
  // that strands somebody who backgrounds the app.
  const shipped = `score.start(() => leave());`;
  assert.ok(/\.start\(\s*\(\s*\)\s*=>/.test(shipped), 'the fixture is not the broken shape');
  assert.ok(!/setTimeout\(leave/.test(shipped), 'the fixture still has a timer');

  const silent = { ...W.WELCOME, skip: '' };
  assert.strictEqual(silent.skip.length, 0, 'the fixture changed nothing');
  return 'a callback exit and a hidden skip are both detected';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
