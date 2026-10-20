// THE LESSONS ARE IN THE PROMPT, NOT JUST IN A FILE NOBODY READS.
//
//   node scripts/check-illustration-prompt.mjs
//
// 17 October 2026. Ruth, after the handstand set had cost five attempts on one
// picture: "Im hoping this is just start up costs and we are saving the prompt
// notes to avoid it happening for the rest of the library."
//
// It was a fair hope and it was not true yet. illustration-brief.mjs held every
// lesson from twenty-two illustrations, carefully written up - and NOTHING
// IMPORTED IT. Every prompt had been hand-written at the tool call. So the same
// faults kept arriving: the face crept back, the wall became a slab, the figure
// turned over in mid-air. A lesson written down in a file nobody reads is not a
// lesson the next picture benefits from.
//
// Worse, STYLE was stale. It still asked for a figure FILLED with flat sage
// green, a "slim curved terracotta arrow" and a "three-quarter view" - three
// things Ruth had rejected weeks apart. Had anything imported it, it would have
// produced the wrong picture on the first call.
//
// So this file asserts that a prompt built by movementPrompt() actually carries
// the things that were learned the expensive way. Each one below is a real
// rejection, and the cost of losing it is another 36p plus her time.

import assert from 'node:assert';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const brief = pathToFileURL(
  path.join(process.cwd(), 'scripts', 'illustration-brief.mjs')
).href;
const { STYLE, NOSE_AND_BUN, movementPrompt, REVIEW_BEFORE_SENDING } = await import(brief);

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

console.log('\n  THE LESSONS REACH THE PROMPT\n');

// A real movement, built the only way a prompt is allowed to be built.
const PROMPT = movementPrompt({
  name: 'chest-to-wall handstand',
  start: 'In a downward dog with the hands at the foot of the wall, hips high.',
  finish: 'Inverted and vertical, her bun against the wall, her nose pointing left.',
  inverted: true,
  connects: 'Her hands stay in the same place on the floor in both frames.',
  ruleOut: 'a forearm stand',
});

check('every rejection Ruth made is still forbidden, by name', () => {
  // THE FACE, FEATURE BY FEATURE. It came back twice on 17 October after five
  // clean pictures, so a general "no facial features" is demonstrably not
  // enough - each one has to be named.
  for (const banned of [
    'no eye',
    'eyelashes',
    'eyebrow',
    'no mouth',
    'lips',
    'chin line',
    'CHEEK BLUSH',
  ]) {
    assert.ok(
      PROMPT.toLowerCase().includes(banned.toLowerCase()),
      `the prompt no longer forbids: ${banned}`
    );
  }
  return '7 face features, each named';
});

check('AND THE BLUSH IS CALLED A SKIN TONE, NOT A FACE DETAIL', () => {
  // Ruth, 17 October: "Face shown and skin is definitely a white person now."
  // The blush is what did that. Explaining WHY it is banned is what stops it
  // being treated as a stylistic nicety the generator can trade away.
  assert.ok(
    /blush is not a face detail/i.test(PROMPT),
    'the prompt no longer says why the blush is banned'
  );
  assert.ok(/skin tone/i.test(PROMPT), 'the prompt no longer names it a skin tone');
  return 'the reason survives, not just the rule';
});

check('the figure is UNFILLED and no skin colour is allowed', () => {
  assert.ok(/UNFILLED/i.test(PROMPT), 'the figure may now be filled');
  assert.ok(
    /cream paper shows straight through/i.test(PROMPT),
    'the prompt no longer says the paper shows through the body'
  );
  for (const tone of ['beige', 'tan', 'sand', 'peach', 'brown']) {
    assert.ok(new RegExp(tone, 'i').test(PROMPT), `${tone} is no longer forbidden`);
  }
  return 'unfilled, and 5 skin tones named';
});

check('an upside-down movement gets the nose and the bun', () => {
  assert.ok(PROMPT.includes(NOSE_AND_BUN), 'an inverted movement no longer states the two marks');
  assert.ok(/torso is a tube/i.test(PROMPT), 'the reason the two marks are needed was lost');

  // AND IT IS NOT ADDED WHERE IT DOES NOT BELONG - a seated stretch does not
  // need a paragraph about which way an inverted body faces.
  const seated = movementPrompt({
    name: 'butterfly stretch',
    start: 'Sitting with the soles of the feet together.',
    finish: 'Folded forward over the legs.',
  });
  assert.ok(!seated.includes(NOSE_AND_BUN), 'a seated movement was given the inverted rule');
  return 'added when inverted, absent when not';
});

check('THE WALL IS A LINE, NOT A SLAB', () => {
  // 17 October: the wall came back as a thick saturated terracotta block that
  // dominated the picture and broke the set.
  assert.ok(/SINGLE FINE LINE/i.test(PROMPT), 'the wall is no longer specified as a line');
  assert.ok(/Do NOT fill it/i.test(PROMPT), 'the wall may now be filled');
  assert.ok(/RIGHT edge/i.test(PROMPT), 'the wall is no longer pinned to one side');
  return 'one line, unfilled, right edge';
});

check('the two frames are required to connect, and the cousin is ruled out', () => {
  assert.ok(/THE TWO FRAMES MUST CONNECT/i.test(PROMPT), 'the frames need not connect');
  assert.ok(/THIS IS NOT A FORARM STAND|THIS IS NOT A FOREARM STAND/i.test(PROMPT), 'ruleOut was dropped');
  return 'connection stated, cousin forbidden';
});

check('and the stale direction, which would have been wrong on the first call', () => {
  // The old STYLE asked for a "slim curved terracotta arrow" and a
  // "three-quarter view" and a figure FILLED with flat sage green. All three
  // were rejected by Ruth, weeks apart, and all three survived in the file
  // because nothing imported it and so nothing ever exercised it.
  assert.ok(!/DIRECTION ARROW/i.test(STYLE), 'the arrow instruction is back');
  assert.ok(/NO ARROW ANYWHERE/i.test(STYLE), 'arrows are no longer forbidden');
  assert.ok(!/three-quarter view/i.test(STYLE), 'the three-quarter view is back');
  assert.ok(/FROM THE SIDE/i.test(STYLE), 'the side-on viewpoint was lost');
  assert.ok(
    !/body[^.]*is filled with ONE flat muted SAGE GREEN/i.test(STYLE),
    'the filled-figure direction is back'
  );
  return 'no arrow, side-on, unfilled';
});

check('AND THIS CHECK CAN FAIL', () => {
  // Every assertion above is "the prompt contains X", which passes on anything
  // long enough. So: a prompt built WITHOUT the brief must fail them.
  const naive = 'Draw a chest-to-wall handstand, two frames stacked.';
  let caught = 0;
  for (const needle of [/CHEEK BLUSH/i, /UNFILLED/i, /SINGLE FINE LINE/i, /NO ARROW ANYWHERE/i]) {
    if (!needle.test(naive)) caught += 1;
  }
  assert.strictEqual(caught, 4, 'a bare prompt somehow satisfies the rules');
  // And the real one really does differ from it.
  assert.ok(PROMPT.length > naive.length * 20, 'the built prompt carries no more than a bare one');
  return 'a hand-written prompt fails all four';
});

check('THE THREE THINGS A REWRITE QUIETLY DROPPED', () => {
  // 18 October 2026. The first loose movement generated from the rebuilt brief
  // came back with a BALD figure, washes bigger than the body, and the figure
  // filling its frame. All three are departures from twenty-one approved
  // drawings, and two were my own doing: rewriting STYLE the day before, I cut
  // the figure-size rule along with the stale ones, and folded the bun into a
  // list of things NOT to draw - where the generator read the paragraph as
  // "draw nothing on the head" and obliged.
  //
  // A rule can be lost by being deleted or by being buried. Both are checked
  // here because one 36p test found both.
  assert.ok(/BUT THE HAIR STAYS/i.test(PROMPT), 'the bun is no longer stated positively');
  assert.ok(/NEVER a bald head/i.test(PROMPT), 'nothing forbids a bald figure');
  assert.ok(
    /THE FIGURE IS SMALL IN THE FRAME/i.test(PROMPT),
    'the figure-size rule has been dropped again'
  );
  assert.ok(/third of the frame/i.test(PROMPT), 'the figure size is no longer quantified');
  // THE BOUND IS HER TORSO, NOT HER. "Smaller than the figure" was the first
  // attempt and it failed on the first movement drawn lying down: a figure on
  // its side is nearly the width of the frame, so the rule permitted a wash the
  // size of a sofa and the generator took it. A bound that grows with the pose
  // is not a bound; a torso is roughly constant whatever the body is doing.
  assert.ok(
    /roughly the size of her TORSO/i.test(PROMPT),
    'the wash size is no longer measured against the torso'
  );
  assert.ok(
    !/CLEARLY SMALLER THAN THE FIGURE/i.test(PROMPT),
    'the pose-dependent wash bound is back'
  );
  assert.ok(/NEVER MERGING INTO ONE MASS/i.test(PROMPT), 'two washes may merge again');

  // The bun must be stated OUTSIDE the paragraph of things not to draw, which
  // is the whole point - it was already in that paragraph when the generator
  // returned a bald head.
  const headPara = PROMPT.slice(PROMPT.indexOf('THE HEAD IS EMPTY'));
  const banList = headPara.slice(0, headPara.indexOf('\n\n'));
  assert.ok(
    !/BUT THE HAIR STAYS/i.test(banList),
    'the bun is buried in the list of things not to draw again'
  );
  return 'bun, figure size and wash size all stated';
});

check('the review checklist leads with the one that costs the most', () => {
  // The head crop is first because it is the fault a whole-image measurement
  // cannot find, and the one that reached her twice.
  assert.ok(Array.isArray(REVIEW_BEFORE_SENDING) && REVIEW_BEFORE_SENDING.length >= 5);
  assert.ok(
    /CROP THE HEAD/i.test(REVIEW_BEFORE_SENDING[0]),
    'the head crop is no longer the first thing checked'
  );
  // It is a note to the reviewer, so it must NOT be sent to the image model.
  assert.ok(
    !STYLE.includes(REVIEW_BEFORE_SENDING[0]),
    'the reviewer checklist leaked into the prompt text'
  );
  return `${REVIEW_BEFORE_SENDING.length} checks, head first, none in the prompt`;
});

check('THE WORDS START AND FINISH APPEAR NOWHERE IN THE PROMPT', () => {
  // Ruth, 20 October 2026: "Text start and finish in drawing". One of the
  // twenty-one came back with START and FINISH painted into the cream margin,
  // and the app writes those same two words beside the picture - so the drawing
  // said everything twice, in a style that exists to be quiet.
  //
  // "ABSOLUTELY NO TEXT ANYWHERE" was already in the prompt and was already
  // being ignored, so saying it louder would have been the fix that is not one.
  //
  // THE CAUSE WAS THE LAST TWO LINES OF THE PROMPT. They read "START, upper
  // frame: ..." and "FINISH, lower frame: ...": the final thing the generator
  // saw before drawing was those two words, capitalised, heading the only two
  // lines that said what to draw. A ban five paragraphs earlier loses to that.
  //
  // AND BANNING THEM BY NAME WAS THE SECOND-BEST ANSWER, which the first
  // attempt at this fix proved: a ban has to name the thing, so the prompt
  // still contained both words. The property worth holding is simpler and
  // stronger - the words are not in the prompt at all, in any case, anywhere.
  // A token that is never shown cannot be copied back.
  const prompt = movementPrompt({ name: 'test move', start: 'a', finish: 'b' });
  const occurrences = (prompt.match(/\bSTART\b|\bFINISH\b/gi) ?? []).length;
  assert.strictEqual(
    occurrences,
    0,
    `the prompt contains START/FINISH ${occurrences} time(s) - the generator paints back what it is shown`
  );
  // The two frames still have to be told apart, by WHERE they are rather than
  // by what they are. "Upper" is not a word anybody captions a drawing with.
  assert.ok(/UPPER FRAME:/.test(prompt), 'the two frames are no longer distinguished');
  assert.ok(/LOWER FRAME:/.test(prompt), 'the two frames are no longer distinguished');
  assert.ok(/no captions/.test(prompt), 'the general no-text rule went with the specific one');
  return 'absent from the prompt entirely; frames named by position';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
