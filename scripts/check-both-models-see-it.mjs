// ANYTHING SHE CAN ASK ABOUT MUST REACH THE MODEL THAT ANSWERS.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-both-models-see-it.mjs
//
// THERE ARE TWO MODELS IN A CHAT TURN.
//
//   THE CLASSIFIER reads the message and decides what happened: is this a food
//   log, is it distress, should something be offered as a save. It has tools. It
//   is handed `personContext`, which is nearly everything the app knows.
//
//   THE WRITER composes the words she reads. It has no tools and can only write
//   prose. It is handed `turnFacts()` plus a short list of `extraBlocks`.
//
// THEY DO NOT GET THE SAME THING, and they should not: the classify prompt
// carries instructions about emitting saves that are correct for a model with a
// tool and catastrophic for one that can only speak.
//
// BUT A FACT SHE CAN ASK ABOUT HAS TO REACH THE WRITER, and three times now it
// has not:
//
//   28 Sept  daily targets, built for months, classify only. "What should I eat
//            for the rest of today?" answered by the half that did not know.
//   6 Oct    her tracked macros. Four sittings. The block was correct every
//            time and the writer had never seen a saturated fat figure.
//   6 Oct    the Care record - mine, built four hours after finding the macro
//            fault, while writing the commit message about it.
//
// Three times is a pattern, and a pattern that costs a day each time it happens
// is worth a check that cannot be forgotten.
//
// WHAT THIS ASSERTS. For every block the classifier is given about her own
// record, there is a counterpart reaching the writer. It reads the route as
// text, which is rough, and rough is the right trade: it over-reports rather
// than under-reports, and a name on the ALLOWED list below is a decision
// somebody has written down.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const routeRaw = readFileSync('app/api/ask-selodia/route.ts', 'utf8');
/**
 * COMMENTS STRIPPED BEFORE ANYTHING IS PARSED.
 *
 * The first version read the writer's list by splitting on commas, and a comment
 * sitting directly above an entry ended up glued to it - so `healthContextBlock`
 * parsed as a sentence about healthContextBlock and the check reported it
 * stranded while it was wired correctly. That is the fourth time this week a
 * check has read its own documentation.
 */
const route = routeRaw
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const chatPath = readFileSync('app/lib/chat-path.ts', 'utf8');

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

console.log('\n  BOTH MODELS SEE WHAT SHE CAN ASK ABOUT\n');

/**
 * Blocks in personContext that are deliberately classify-only, each with the
 * reason. Anything NOT on this list must have a counterpart reaching the writer.
 */
const CLASSIFY_ONLY = {
  // `twin` is the block the writer gets instead. Named, not derived: the twin of
  // meCardsBlock is meFactsBlock, and the first version of this guessed
  // meCardsFactsBlock and failed on its own naming rule.
  meCardsBlock: { twin: 'meFactsBlock', why: 'carries proposedSave instructions, which are catastrophic for a model that can only write prose' },
  careBlock: { twin: 'careFactsBlock', why: 'same shape as the Me block' },
  insightsBlock: { why: 'the writer twin is built inside turnFacts' },
  plansBlock: { why: 'saved plans are offered by the classifier, never described by the writer' },
  trackedMacroBlock: { why: 'the figures reach the writer on the foodFacts day lines, since 6 October' },
  cycleContextBlock: { why: 'cycleFacts() in turnFacts carries the cycle day and phase' },
  recoverableBlock: { why: 'restoreId is a tool field, so only the classifier can act on it' },
};

/**
 * EMPTY, AND IT WAS FIVE ITEMS LONG FOR ABOUT AN HOUR.
 *
 * The check found eight blocks reaching the classifier and not the writer on its
 * first run. Three had a legitimate route to the writer already and are named in
 * CLASSIFY_ONLY above. The other five were read, one at a time, and every one of
 * them turned out to be writer-facing:
 *
 *   allergyBlock        "Never suggest, recommend or include any of them." A
 *                       constraint on what the model SUGGESTS, given only to the
 *                       model that suggests nothing. The four-layer allergy gate
 *                       behind it is code and caught every bad suggestion, so
 *                       nothing unsafe reached her - layer one was simply absent
 *                       and the other three were carrying it.
 *   rulesBlock          the same shape, for movements.
 *   healthContextBlock  "Gently flag saturated fat rather than treating it as
 *                       expendable." Instructions about how to talk.
 *   yesterdayBlock      "Say it once, warmly, as context rather than as
 *                       reassurance they asked for."
 *   longHistoryBlock    six months of monthly averages. "How was my weight in
 *                       August?" could not be answered.
 *
 * A NEW ENTRY HERE IS A DECISION SOMEBODY WROTE DOWN, not a hole that drifted
 * open. Anything not here and not in CLASSIFY_ONLY fails this check outright.
 */
const UNRESOLVED = [];

check('every record block the classifier gets has a way to the writer', () => {
  // The blocks interpolated into personContext.
  const at = route.indexOf('const personContext');
  assert.ok(at > 0, 'personContext is gone');
  const assembled = route.slice(at, at + 4000);
  const blocks = [...assembled.matchAll(/\$\{(\w*Block)\}/g)].map((m) => m[1]);
  assert.ok(blocks.length > 0, 'no blocks found in personContext, so this checks nothing');

  const writerLine = route.match(/extraBlocks: \[([^\]]*)\]/);
  assert.ok(writerLine, 'the writer is given no extraBlocks at all');
  const writerBlocks = writerLine[1].split(',').map((s) => s.trim());

  const stranded = blocks.filter((b) => {
    if (b in CLASSIFY_ONLY) return false;
    if (UNRESOLVED.includes(b)) return false;
    if (writerBlocks.includes(b)) return false;
    // A twin named `xFactsBlock` for `xBlock` counts.
    const twin = b.replace(/Block$/, 'FactsBlock');
    return !writerBlocks.includes(twin);
  });

  assert.deepStrictEqual(
    stranded,
    [],
    `${stranded.join(', ')} reaches the classifier and not the writer, which is the ` +
      'fault that cost four sittings on saturated fat. Settle it, or put it on ' +
      'UNRESOLVED with what you actually checked.'
  );

  // THE BACKLOG, SAID OUT LOUD ON EVERY RUN. A list nobody sees is a list nobody
  // clears, and this one was eight items long the first time it ran.
  const stillOpen = UNRESOLVED.filter((b) => blocks.includes(b));
  if (stillOpen.length > 0) {
    console.log(`        NOTE  ${stillOpen.length} unresolved: ${stillOpen.join(', ')}`);
  }
  return `${blocks.length} blocks, ${writerBlocks.length} reaching the writer`;
});

check('each classify-only block has a named twin that really exists', () => {
  // A reason written in this file is not a twin. The twin has to be in the route
  // AND in the writer's list, or the exemption is just a note excusing a hole.
  const writerLine = route.match(/extraBlocks: \[([^\]]*)\]/);
  const writerBlocks = writerLine[1].split(',').map((s) => s.trim());
  for (const [block, entry] of Object.entries(CLASSIFY_ONLY)) {
    if (!entry.twin) continue;
    assert.ok(
      route.includes(`const ${entry.twin}`),
      `${block} claims ${entry.twin} is its writer twin and no such block is built`
    );
    assert.ok(
      writerBlocks.includes(entry.twin),
      `${entry.twin} is built and never handed to the writer`
    );
  }
  const named = Object.values(CLASSIFY_ONLY).filter((e) => e.twin).length;
  return `${named} twin(s) built and wired`;
});

check('both writer calls get the same list', () => {
  // Wiring one of two is how a fix reaches half an app: one path is voice, one
  // is typed, and the typed one is the one she uses.
  const lists = [...route.matchAll(/extraBlocks: \[([^\]]*)\]/g)].map((m) =>
    m[1].split(',').map((s) => s.trim()).join('|')
  );
  assert.strictEqual(lists.length, 2, `expected two writer calls, found ${lists.length}`);
  assert.strictEqual(lists[0], lists[1], 'the voice path and the typed path are given different records');
  return 'voice and typed are identical';
});

check('the writer is the one without tools, so it can only speak', () => {
  // The distinction this whole file rests on, asserted so the explanation cannot
  // quietly stop being true.
  assert.ok(/tool_choice/.test(route), 'the classify call no longer uses a tool');
  assert.ok(!/tool_choice/.test(chatPath), 'the writer has been given a tool, which changes everything here');
  return 'classifier decides, writer speaks';
});

check('and this check can fail', () => {
  const pretendRoute = 'const personContext = `${foodBlock}${newThingBlock}`;\n extraBlocks: [foodBlock],';
  const blocks = [...pretendRoute.matchAll(/\$\{(\w*Block)\}/g)].map((m) => m[1]);
  const writer = pretendRoute.match(/extraBlocks: \[([^\]]*)\]/)[1].split(',').map((s) => s.trim());
  const stranded = blocks.filter((b) => !writer.includes(b) && !writer.includes(b.replace(/Block$/, 'FactsBlock')));
  assert.deepStrictEqual(stranded, ['newThingBlock'], 'a block reaching only the classifier is not detected');
  return 'a new classify-only block is caught';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
