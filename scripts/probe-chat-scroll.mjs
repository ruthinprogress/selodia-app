// OPENING WHERE THE CHAT IS UP TO, RATHER THAN TRAVELLING THERE.
//
// Ruth, 21 September 2026: "when you open the app, the chat scrolls violently
// through all the past chat, landing in the present. It doesn't feel calm at
// all. Can we change it so it just opens where the chat is actually up to, not
// mad scrolling to the present?"
//
//   npx tsx scripts/probe-chat-scroll.mjs

import { OPENING_MS, shouldAnimate } from '../mobile/src/lib/chat-scroll-rules.ts';

let passed = 0;
let failed = 0;

function check(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
  }
}

const SCREEN = 800;

console.log('\n  THE OPENING IS A PERIOD, NOT AN EVENT\n');

// THE BUG SHE REPORTED, exactly. A thread does not arrive in one frame: the
// history, then the images, then a food table filling in under a turn from
// three weeks ago. Every one of those used to animate.
check('the first chunk of history', shouldAnimate(0, 4000, SCREEN), false);
check('the second chunk, a moment later', shouldAnimate(300, 2000, SCREEN), false);
check('an image arriving during the opening', shouldAnimate(1200, 300, SCREEN), false);
check('a table filling in during the opening', shouldAnimate(2400, 200, SCREEN), false);

console.log('\n  AFTERWARDS, A NEW MESSAGE STILL ANIMATES\n');

// Animation earns its keep in exactly one place: saying something new came in.
check('a reply a few seconds later', shouldAnimate(6000, 120, SCREEN), true);
check('a long reply', shouldAnimate(6000, 380, SCREEN), true);
check('the instant the opening ends', shouldAnimate(OPENING_MS, 100, SCREEN), true);

console.log('\n  A BIG JUMP IS NEVER ANIMATED, HOWEVER LATE\n');

// A slow history query can finish after any timer, and scrolling a screenful is
// the violent motion itself regardless of what the clock says.
check('history landing late', shouldAnimate(9000, 3000, SCREEN), false);
check('exactly half a screen is still a message', shouldAnimate(9000, SCREEN / 2, SCREEN), true);
check('a shade over half a screen is the past arriving', shouldAnimate(9000, SCREEN / 2 + 1, SCREEN), false);
// A SMALL SCREEN HAS A SMALLER THRESHOLD, which is the point of measuring
// against the screen rather than a fixed number of pixels.
check('the threshold follows the screen', shouldAnimate(9000, 300, 400), false);

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
