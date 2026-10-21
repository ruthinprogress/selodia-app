// CALCIUM AND IRON ARE OFFERED, AND ASKED FOR.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-calcium-and-iron.mjs
//
// Ruth, 21 October 2026: "Lets offer calcium and iron. Its important to my
// demographic."
//
// She is right and they are the two that are specifically right: a woman over
// forty is losing bone density whether or not she is watching it, and a woman
// still menstruating is losing iron every month.
//
// WHAT WAS ACTUALLY WRONG, measured in her own 161 food entries before this:
// calcium was asked for by the parser and offered to nobody, so 39% of her
// items carried a figure that no screen could ever show. Iron was not asked
// for at all - 0% of 360 items - so the column had been sitting in two tables
// since the parser was written, holding nothing.
//
// A MACRO YOU CANNOT SWITCH ON IS A COLUMN, NOT A FEATURE. And a macro you can
// switch on that nothing fills is worse: it is a row of blanks on a screen she
// turned on in order to watch something.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { MACROS, OPTIONAL, macroFigure, macroLine, trackedMacros } = await import(
  here('mobile/src/lib/tracked-macros.ts')
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

const prompt = fs.readFileSync('app/lib/food-parse-prompt.ts', 'utf8');
const writing = fs.readFileSync('app/lib/food-logging.ts', 'utf8');

console.log('\n  CALCIUM AND IRON\n');

check('BOTH CAN BE SWITCHED ON', () => {
  for (const key of ['calcium', 'iron']) {
    const spec = MACROS.find((m) => m.key === key);
    assert.ok(spec, `${key} is not a macro anybody can choose`);
    assert.ok(OPTIONAL.some((m) => m.key === key), `${key} cannot be switched on`);
    assert.strictEqual(spec.unit, 'mg', `${key} is measured in ${spec.unit}`);
    // The toggle says why it is worth watching, which is the whole reason she
    // asked for these two rather than for a longer list.
    assert.ok(spec.detail && spec.detail.length > 20, `${key} is offered with no reason given`);
  }
  assert.ok(trackedMacros(['iron']).includes('iron'), 'switching iron on does not stick');
  return 'both optional, both in mg, both explained';
});

check('AND MILLIGRAMS ARE NOT PRINTED AS GRAMS', () => {
  // The formatter said `${n} g` for everything that was not kcal. 243 mg of
  // calcium shown as "243 g" is not a rounding error, it is a different food.
  assert.strictEqual(macroFigure('calcium', { calcium_mg: 243 }), '243 mg');
  assert.strictEqual(macroFigure('iron', { iron_mg: 2.6 }), '3 mg');
  assert.strictEqual(macroFigure('protein', { protein_g: 23 }), '23 g');
  const line = macroLine({ kcal: 400, protein_g: 23, calcium_mg: 243, iron_mg: 2.6 }, [
    'kcal', 'protein', 'calcium', 'iron',
  ]);
  assert.ok(/243 mg calcium/.test(line), line);
  assert.ok(/3 mg iron/.test(line), line);
  assert.ok(!/243 g/.test(line), `milligrams printed as grams: ${line}`);
  return '243 mg calcium, 3 mg iron';
});

check('AND A FIGURE NOBODY WORKED OUT IS STILL LEFT OUT', () => {
  // The rule these two inherit. A macro switched on is one somebody wants to
  // watch, and a zero she cannot tell from a real figure is the worst answer.
  assert.strictEqual(macroFigure('iron', { iron_mg: null }), null, 'a missing iron figure became something');
  const line = macroLine({ kcal: 400, iron_mg: null }, ['kcal', 'iron']);
  assert.ok(!/iron/.test(line), `an absent iron figure appeared on the row: ${line}`);
  assert.strictEqual(macroFigure('iron', { iron_mg: 0 }), '0 mg', 'a real zero was dropped');
  return 'absent is absent, zero is zero';
});

check('THE PARSER IS ASKED FOR BOTH', () => {
  // Iron was never asked for, which is why every one of 360 items held null.
  for (const field of ['calcium_mg', 'iron_mg']) {
    // Once on the log and once on each item - a total with no items behind it
    // cannot be broken down afterwards.
    const inSchema = [...prompt.matchAll(new RegExp(`"${field}": number`, 'g'))];
    assert.strictEqual(inSchema.length, 2, `${field} appears ${inSchema.length} times in the schema, not twice`);
    assert.ok(new RegExp(`${field}\\?: number`).test(prompt), `${field} is missing from the parsed types`);
  }
  assert.ok(/For iron_mg \(on the log and on each item\)/.test(prompt), 'nothing tells the model how to estimate iron');
  return 'both on the log and on every item';
});

check('AND TOLD THE TWO TRAPS', () => {
  // Spinach is famous for both and absorbed for neither, and it is exactly the
  // food somebody logs expecting the number to be high.
  const spinach = [...prompt.matchAll(/SPINACH IS/g)];
  assert.strictEqual(spinach.length, 2, `spinach is warned about ${spinach.length} times, not twice`);
  // AND NO ABSORPTION ARITHMETIC. Tea with a meal really does cut non-haem
  // iron absorption, and a figure quietly adjusted for it is one nobody can
  // check against a label.
  assert.ok(/NEVER adjust the iron figure/.test(prompt), 'the model may adjust iron for absorption');
  assert.ok(/[Oo]mit iron_mg entirely/.test(prompt), 'iron may be guessed at');
  return 'spinach twice, no absorption maths';
});

check('AND BOTH REACH THE ROW THAT IS SAVED', () => {
  for (const field of ['calcium_mg', 'iron_mg']) {
    assert.ok(new RegExp(`${field}: macros\\.${field}`).test(writing), `${field} is parsed and then dropped`);
    assert.ok(new RegExp(`${field}: it\\.${field}`).test(writing), `${field} is not stored on the item`);
    assert.ok(new RegExp(`${field}: sum\\(`).test(writing), `${field} is not summed from the items`);
  }
  return 'log, item, and the total';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
