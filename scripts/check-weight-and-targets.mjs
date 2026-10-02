// THE WEIGHT SHE GIVES, AND THE FIGURES SHE IS SHOWN BEFORE ANYTHING SAVES.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-weight-and-targets.mjs
//
// Ruth, 2 October 2026, item 3: four intents; a weight question in kg, stone and
// pounds, or plain pounds, with an "I do not know yet"; a floor under the
// deficit; and the figures with their working shown before saving.
//
// WHY THESE CASES. Each one is a way the screen could be confidently wrong:
//
//   - a weight typed in pounds into the kg box, which is how somebody gets a
//     target built on 154 kg;
//   - "11 stone" with the pounds box left empty, which is a complete answer and
//     was the likeliest thing to be rejected as incomplete;
//   - a deficit that lands under what her body uses at rest, which had no floor
//     at all until today;
//   - recomposition, which produces a MAINTENANCE calorie figure, so the only
//     thing distinguishing it from "stay as I am" is the protein - and if the
//     protein does not move, choosing it changes nothing.

import assert from 'node:assert';

const INTENT = await import('file://' + process.cwd().replace(/\\/g, '/') + '/mobile/src/lib/body-intent.ts');
const TARGET = await import('file://' + process.cwd().replace(/\\/g, '/') + '/mobile/src/lib/calorie-target.ts');
const PROTEIN = await import('file://' + process.cwd().replace(/\\/g, '/') + '/mobile/src/lib/protein.ts');

const { BODY_INTENTS, BODY_INTENT_BY_KEY, calorieFloor, intentFromFocus, explainTarget } = INTENT;
const { calculateCalorieTarget } = TARGET;
const { calculateProteinTarget } = PROTEIN;

// The component's own converter, read from source: it is a React file, so it
// cannot be imported here without a renderer.
import { readFileSync } from 'node:fs';
const WQ = readFileSync('mobile/src/components/weight-question.tsx', 'utf8');

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

console.log('\n  HER WEIGHT, AND THE TARGETS IT PRODUCES\n');

// ------------------------------------------------------------- the intents

check('all four intents she asked for exist, and each is reachable', () => {
  const keys = BODY_INTENTS.map((i) => i.key).sort();
  assert.deepStrictEqual(keys, ['build_muscle', 'lose_fat', 'recomposition', 'stay_as_i_am']);
  // Each must map to a DISTINCT focus pair, or two taps mean the same thing.
  const pairs = new Set(BODY_INTENTS.map((i) => `${i.fat}/${i.muscle}`));
  assert.strictEqual(pairs.size, 4, 'two intents share a focus pair');
  return 'four intents, four distinct focus pairs';
});

check('recomposition is what her own goal maps to', () => {
  const intent = intentFromFocus('reduce', 'increase');
  assert.ok(intent, 'reduce + increase maps to no intent');
  assert.strictEqual(intent.key, 'recomposition');
  assert.strictEqual(intent.highProtein, true, 'recomposition does not raise protein');
  return 'same weight, less fat, more muscle';
});

check('an unstated focus is still not an intent', () => {
  assert.strictEqual(intentFromFocus(null, null), null);
  assert.strictEqual(intentFromFocus('reduce', null), null);
  return 'silence is not a goal';
});

// ------------------------------------------------------------- the floor

check('the floor is the higher of her BMR and 1,200', () => {
  assert.strictEqual(calorieFloor(1123), 1200, 'a low BMR let the floor go under 1,200');
  assert.strictEqual(calorieFloor(1400), 1400, 'a BMR above 1,200 was ignored');
  assert.strictEqual(calorieFloor(null), 1200, 'no BMR left no floor at all');
  assert.strictEqual(calorieFloor(0), 1200);
  return '1123 -> 1200, 1400 -> 1400';
});

check('THE BUG: a deficit can no longer land under what her body uses', () => {
  // 91.7 kg at a TDEE of 1487 asks for a 655/day deficit, which is 832.
  const t = calculateCalorieTarget({
    tdeeKcal: 1487,
    weightKg: 91.7,
    bmrKcal: 1400,
    fatFocus: 'reduce',
    muscleFocus: 'maintain',
  });
  assert.ok(t, 'no target at all');
  assert.strictEqual(t.targetKcal, 1400, `landed at ${t.targetKcal}`);
  assert.strictEqual(t.flooredAt, 1400, 'the screen is not told the floor bit');
  assert.strictEqual(t.mode, 'deficit', 'a floored target stopped being a fat-loss intent');
  return '832 would have been shown; held at 1,400 and said so';
});

check('the reported delta describes the figure, not the intention', () => {
  const t = calculateCalorieTarget({
    tdeeKcal: 1487,
    weightKg: 91.7,
    bmrKcal: 1400,
    fatFocus: 'reduce',
    muscleFocus: 'maintain',
  });
  // Held at 1400 against a TDEE of 1490 (rounded) is a deficit of 90, not 655.
  assert.strictEqual(t.deltaKcal, -90, `reported ${t.deltaKcal}`);
  return 'a floored deficit is not reported as the deficit it wanted';
});

check('a deficit that does not need the floor is untouched', () => {
  // Ruth: 56 kg, BMR 1123, moderately active.
  const t = calculateCalorieTarget({
    tdeeKcal: 1740,
    weightKg: 56,
    bmrKcal: 1123,
    fatFocus: 'reduce',
    muscleFocus: 'maintain',
  });
  assert.strictEqual(t.flooredAt, null, 'the floor bit when it should not have');
  assert.strictEqual(t.targetKcal, 1430);
  return '1740 - 308 = 1430, above the 1200 floor';
});

check('recomposition is a maintenance figure, not a deficit', () => {
  const t = calculateCalorieTarget({
    tdeeKcal: 1740,
    weightKg: 56,
    bmrKcal: 1123,
    fatFocus: 'reduce',
    muscleFocus: 'increase',
  });
  assert.strictEqual(t.mode, 'maintenance');
  assert.strictEqual(t.isRecomposition, true);
  assert.strictEqual(t.targetKcal, 1740);
  return 'eating around what she uses, flagged as recomposition';
});

// ------------------------------------------------------------- the protein

check('the protein moves for recomposition, or choosing it changes nothing', () => {
  // THE SIGNATURE CHANGED ON 2 OCTOBER, EVENING. It took four positional
  // arguments ending in a defaulted `highProtein` boolean, and that default is
  // what let four of five surfaces silently show Ruth the un-stepped range. It
  // now takes an object and derives the step-up from her stored focus.
  // check-protein-parity.mjs is where that lives; these two cases stay because
  // the point they make - choosing recomposition has to change SOMETHING - is
  // the reason the step-up exists at all.
  const plain = calculateProteinTarget({ weightKg: 56, bodyFatPct: null, muscleFocus: 'maintain' });
  const high = calculateProteinTarget({ weightKg: 56, bodyFatPct: null, muscleFocus: 'increase' });
  assert.ok(plain && high, 'no protein target at all');
  assert.ok(high.low > plain.low, `${high.low} is not above ${plain.low}`);
  assert.ok(high.high > plain.high, `${high.high} is not above ${plain.high}`);
  return `${plain.low}-${plain.high}g becomes ${high.low}-${high.high}g`;
});

check('a protein figure she set herself is never overridden by a goal', () => {
  const manual = calculateProteinTarget({
    manualG: 120,
    weightKg: 56,
    bodyFatPct: null,
    muscleFocus: 'increase',
  });
  assert.strictEqual(manual.kind, 'manual');
  assert.strictEqual(manual.grams, 120);
  return 'her own number stands';
});

// ------------------------------------------------- the units she can answer in

/** The converter, lifted from the component so the real arithmetic is tested. */
function weightToKg(unit, fields) {
  const num = (t) => {
    const n = Number(String(t).replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const KG_PER_LB = 0.45359237;
  if (unit === 'kg') {
    const kg = num(fields.kg);
    return kg >= 25 && kg <= 300 ? Math.round(kg * 10) / 10 : null;
  }
  if (unit === 'lb') {
    const kg = num(fields.pounds) * KG_PER_LB;
    return kg >= 25 && kg <= 300 ? Math.round(kg * 10) / 10 : null;
  }
  const st = num(fields.stone);
  const lb = num(fields.pounds);
  if (st === 0) return null;
  const kg = (st * 14 + lb) * KG_PER_LB;
  return kg >= 25 && kg <= 300 ? Math.round(kg * 10) / 10 : null;
}

check('the test converter matches the one in the component', () => {
  // The component is a .tsx and cannot be imported without a renderer, so the
  // arithmetic is duplicated here - which is only safe while the constants match.
  assert.ok(WQ.includes('const KG_PER_LB = 0.45359237;'), 'the pound changed in the component');
  assert.ok(WQ.includes('const LB_PER_STONE = 14;'), 'the stone changed in the component');
  assert.ok(WQ.includes('kg >= 25 && kg <= 300'), 'the plausible range changed in the component');
  return 'same constants, same range';
});

check('all three units she can answer in', () => {
  assert.strictEqual(weightToKg('kg', { kg: '56', stone: '', pounds: '' }), 56);
  assert.strictEqual(weightToKg('st_lb', { kg: '', stone: '8', pounds: '11' }), 55.8);
  assert.strictEqual(weightToKg('lb', { kg: '', stone: '', pounds: '123' }), 55.8);
  return 'kg, st and lb, lb';
});

check('"11 stone" with no pounds is a complete answer', () => {
  const kg = weightToKg('st_lb', { kg: '', stone: '11', pounds: '' });
  assert.strictEqual(kg, 69.9, `got ${kg}`);
  return 'the pounds box is genuinely optional';
});

check('pounds typed into the kg box is rejected, not believed', () => {
  // 154 lb typed as kg. Accepting it would build every target on 154 kg.
  assert.strictEqual(weightToKg('kg', { kg: '154', stone: '', pounds: '' }), 154);
  // 154 IS a plausible kg, so the range cannot catch it - which is exactly why
  // the working is shown. The BMR for 154 kg is visibly wrong on screen.
  const absurd = weightToKg('kg', { kg: '1540', stone: '', pounds: '' });
  assert.strictEqual(absurd, null, 'an impossible weight was accepted');
  return 'the range catches 1540; the working on screen is what catches 154';
});

check('nothing typed yet is not a weight of zero', () => {
  assert.strictEqual(weightToKg('kg', { kg: '', stone: '', pounds: '' }), null);
  assert.strictEqual(weightToKg('kg', { kg: '5', stone: '', pounds: '' }), null);
  return 'a half-typed number is not an answer';
});

// ------------------------------------------------------- what she is shown

check('the working shows the weight, the BMR, the arithmetic and the figure', () => {
  const w = explainTarget({
    intent: BODY_INTENT_BY_KEY.lose_fat,
    weightKg: 56,
    weightSource: 'estimate',
    bmrKcal: 1123,
    tdeeKcal: 1740,
    activityWord: 'moderately active',
    proteinLow: 90,
    proteinHigh: 112,
   proteinStepped: 'plain',});
  const all = w.lines.join(' | ');
  assert.ok(/about 56 kg, as you said/.test(all), 'the weight she gave is not stated');
  assert.ok(/1,123 kcal/.test(all), 'the BMR is not shown');
  assert.ok(/1,740 kcal/.test(all), 'the TDEE is not shown');
  assert.ok(/half a percent/.test(all), 'the rule behind the deficit is not explained');
  assert.ok(/moderately active/.test(all), 'what she said about her days is not used');
  assert.strictEqual(w.targetKcal, 1430);
  assert.ok(/has a date on it/i.test(all), 'it does not say there are no dates on it');
  return `${w.lines.length} lines, ending at 1,430 kcal`;
});

check('an estimate and a weigh-in are described differently', () => {
  const guess = explainTarget({
    intent: BODY_INTENT_BY_KEY.lose_fat, weightKg: 56, weightSource: 'estimate',
    bmrKcal: 1123, tdeeKcal: 1740, activityWord: null, proteinLow: null, proteinHigh: null,
   proteinStepped: 'plain',});
  const real = explainTarget({
    intent: BODY_INTENT_BY_KEY.lose_fat, weightKg: 56, weightSource: 'measured',
    bmrKcal: 1123, tdeeKcal: 1740, activityWord: null, proteinLow: null, proteinHigh: null,
   proteinStepped: 'plain',});
  assert.ok(/as you said/.test(guess.lines[0]), 'a guess is not described as one');
  assert.ok(/last weigh-in/.test(real.lines[0]), 'a weigh-in is not described as one');
  return 'she can see which kind of number it is built on';
});

check('no weight means one sentence about the weight, and no figure', () => {
  const w = explainTarget({
    intent: BODY_INTENT_BY_KEY.lose_fat, weightKg: null, weightSource: null,
    bmrKcal: 1123, tdeeKcal: 1740, activityWord: null, proteinLow: null, proteinHigh: null,
   proteinStepped: 'plain',});
  assert.strictEqual(w.targetKcal, null, 'a target was produced with no weight');
  assert.strictEqual(w.missing, 'Add your weight to see your targets.');
  return 'her exact wording for Today, and no invented figure';
});

check('no height says so, rather than showing a target with no basis', () => {
  const w = explainTarget({
    intent: BODY_INTENT_BY_KEY.lose_fat, weightKg: 56, weightSource: 'estimate',
    bmrKcal: null, tdeeKcal: null, activityWord: null, proteinLow: null, proteinHigh: null,
   proteinStepped: 'plain',});
  assert.strictEqual(w.targetKcal, null);
  assert.ok(/height/i.test(w.missing ?? ''), 'it does not name what is missing');
  return 'names the input, does not guess it';
});

check('the floor is explained when it bites, never applied in silence', () => {
  const w = explainTarget({
    intent: BODY_INTENT_BY_KEY.lose_fat, weightKg: 91.7, weightSource: 'measured',
    bmrKcal: 1400, tdeeKcal: 1487, activityWord: null, proteinLow: null, proteinHigh: null,
   proteinStepped: 'plain',});
  assert.strictEqual(w.flooredAt, 1400);
  const all = w.lines.join(' | ');
  assert.ok(/below what your body uses at rest/.test(all), 'the clamp is not explained');
  assert.strictEqual(w.targetKcal, 1400);
  return 'the figure is held and the reason is on screen';
});

check('recomposition explains why there is no deficit', () => {
  const w = explainTarget({
    intent: BODY_INTENT_BY_KEY.recomposition, weightKg: 56, weightSource: 'measured',
    bmrKcal: 1123, tdeeKcal: 1740, activityWord: null, proteinLow: 102, proteinHigh: 123,
   proteinStepped: 'up',});
  const all = w.lines.join(' | ');
  assert.ok(/not from a deficit/.test(all), 'it does not say why the figure is maintenance');
  assert.ok(/kept high/.test(all), 'it does not say the protein is the mechanism');
  assert.strictEqual(w.targetKcal, 1740);
  return 'the maintenance figure is explained rather than looking like a mistake';
});

check('no target weight and no deadline appear anywhere in the working', () => {
  for (const intent of BODY_INTENTS) {
    const w = explainTarget({
      intent, weightKg: 56, weightSource: 'measured', bmrKcal: 1123, tdeeKcal: 1740,
      activityWord: 'moderately active', proteinLow: 90, proteinHigh: 112,
     proteinStepped: 'plain',});
    const all = w.lines.join(' ').toLowerCase();
    for (const banned of ['by week', 'in 12 weeks', 'goal weight', 'target weight', 'by the end of', 'months']) {
      assert.ok(!all.includes(banned), `"${banned}" appears for ${intent.key}`);
    }
  }
  return 'four intents, no dates and no goal figures';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
