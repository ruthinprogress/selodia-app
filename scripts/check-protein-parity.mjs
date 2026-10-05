// DO ALL FIVE SURFACES SHOW HER THE SAME PROTEIN TARGET?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-protein-parity.mjs
//
// THE BUG THIS EXISTS FOR. On 2 October 2026 Ruth photographed two screens one
// minute apart, on the same body, in the same app:
//
//   Today:        "Aiming for 1350 kcal - 82-98g protein"
//   Goals screen: "Protein 101 to 123 g a day, kept high because that is what
//                  protects muscle"
//
// Both were the same function. Neither was the other one rounded.
//
//   Today:  (protein_target_g, 56.6, 27.6)        -> lean mass 41 kg x 2.0-2.4
//   Goals:  (null, 56.6, null, highProtein=true)  -> bodyweight 56.6 x 1.8-2.2
//
// The goals screen knew her GOAL and not her BODY FAT. Every other surface knew
// her body fat and not her goal. Two different bases AND a missing flag, pulling
// in opposite directions.
//
// WHY NOTHING CAUGHT IT. `highProtein` was added that morning as a fourth
// POSITIONAL argument with a default of `false`, for the one screen that needed
// it. A defaulted trailing boolean is invisible at every other call site: four of
// them kept compiling, kept returning a plausible number, and silently asserted
// "her goal does not ask for more protein" when nobody had asked the question.
// probe-target-parity.mjs covered the CALORIE target only, so the mirror it
// guarded was not the one that split.
//
// WHAT THIS CHECKS, in order of how much it would have helped:
//
//   1. No call site can omit her goal or her body fat. A SOURCE check, because
//      the failure was in what callers passed, not in the arithmetic - every
//      case below passed on the broken code.
//   2. The two mirrors (Expo and Next) return identical output on a grid.
//   3. The step-up derivation matches the declared intent table, so
//      `muscle === 'increase'` and `highProtein` cannot drift apart.
//   4. Her own body, through the path each surface now takes, gives one answer.
//   5. A pause lands ON the maintenance range and never under it.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const MOBILE = await import(root + '/mobile/src/lib/protein.ts');
const NEXT = await import(root + '/app/lib/body-metrics.ts');
const INTENT = await import(root + '/mobile/src/lib/body-intent.ts');

const { calculateProteinTarget, proteinStep, proteinAssumptionNote } = MOBILE;
const { proteinTarget } = NEXT;
const { BODY_INTENTS, gainSurplusKcal } = INTENT;

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

console.log('\n  ONE PROTEIN TARGET, NOT FIVE\n');

// ---- 1. no caller can leave out what it needs ---------------------------
//
// THIS IS THE CHECK THAT MATTERS. Every behavioural case below this one passed
// on the code that showed Ruth two numbers, because each surface was internally
// consistent - the disagreement only existed BETWEEN them.
const CALL_SITES = [
  ['mobile/src/app/goal.tsx', 'calculateProteinTarget'],
  ['mobile/src/app/onboarding/goals.tsx', 'calculateProteinTarget'],
  ['mobile/src/components/overview-panel.tsx', 'calculateProteinTarget'],
  ['app/api/onboarding-chat/route.ts', 'proteinTarget'],
  ['app/lib/daily-targets.ts', 'proteinTarget'],
];

check('every surface tells the sum her goal and her body fat', () => {
  const missing = [];
  for (const [file, fn] of CALL_SITES) {
    const src = readFileSync(file, 'utf8');
    const at = src.indexOf(fn + '({');
    if (at < 0) {
      // A POSITIONAL CALL IS THE BUG ITSELF. `fn(` with no brace is the old
      // four-argument shape, where a forgotten flag defaults silently.
      missing.push(`${file}: no object call to ${fn}() - positional arguments are how this broke`);
      continue;
    }
    // The argument object, to its closing brace.
    const end = src.indexOf('});', at);
    const args = src.slice(at, end < 0 ? at + 600 : end);
    for (const field of ['weightKg', 'bodyFatPct', 'muscleFocus', 'training']) {
      if (!args.includes(field + ':') && !args.includes(field + ',')) {
        missing.push(`${file}: ${fn}() is not passed ${field}`);
      }
    }
  }
  assert.ok(
    missing.length === 0,
    missing.join('\n          ') +
      '\n          A surface that does not pass her goal shows the plain range while ' +
      'the goals screen shows the stepped-up one. That is the two-targets bug.'
  );
  return `${CALL_SITES.length} call sites, each passing all four`;
});

check('the flag that caused it is gone from the signature', () => {
  // A DEFAULTED TRAILING BOOLEAN CANNOT BE SEEN AT A CALL SITE. If one comes
  // back, so does the bug, and nothing else in this file would notice.
  for (const [file, src] of [
    ['mobile/src/lib/protein.ts', readFileSync('mobile/src/lib/protein.ts', 'utf8')],
    ['app/lib/body-metrics.ts', readFileSync('app/lib/body-metrics.ts', 'utf8')],
  ]) {
    assert.ok(
      !/highProtein\s*=\s*false/.test(src),
      `${file} still takes a defaulted highProtein argument`
    );
  }
  return 'the step-up is derived, not passed';
});

// ---- 2. the two mirrors ---------------------------------------------------
check('Expo and Next agree on every combination', () => {
  const weights = [null, 48, 56.6, 90];
  const fats = [null, 2, 27.6, 40, 80];
  const focuses = [null, 'reduce', 'maintain', 'increase'];
  const trainings = [null, 'training', 'paused'];
  const manuals = [null, 0, 120];
  let n = 0;
  for (const weightKg of weights)
    for (const bodyFatPct of fats)
      for (const muscleFocus of focuses)
        for (const training of trainings)
          for (const manualG of manuals) {
            const input = { manualG, weightKg, bodyFatPct, muscleFocus, training };
            const a = calculateProteinTarget(input);
            const b = proteinTarget(input);
            assert.deepStrictEqual(
              a,
              b,
              `mirrors disagree on ${JSON.stringify(input)}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`
            );
            n += 1;
          }
  return `${n} combinations, identical on both sides`;
});

// ---- 3. the derivation matches the declared table -------------------------
check('the step-up derivation matches the intent table', () => {
  // protein.ts derives the step-up from `muscle === 'increase'` and deliberately
  // does NOT import the intent table, so that the Next mirror needs no copy of
  // it. That independence is only safe while this holds.
  for (const intent of BODY_INTENTS) {
    const step = proteinStep({ muscleFocus: intent.muscle, training: null });
    assert.strictEqual(
      step === 'up',
      intent.highProtein,
      `${intent.key} declares highProtein=${intent.highProtein} but the sum says ${step}`
    );
  }
  return `${BODY_INTENTS.length} intents, declaration and derivation agree`;
});

// ---- 4. her body, through each surface's path -----------------------------
check('Ruth on 2 October gets one answer, not two', () => {
  // The exact numbers from her two screenshots: 56.6 kg, 27.6% body fat, "less
  // fat, more muscle" (muscle: increase), nothing said about training.
  const body = { weightKg: 56.6, bodyFatPct: 27.6, muscleFocus: 'increase', training: null };

  // The goals screen, which used to pass bodyFatPct: null.
  const goals = calculateProteinTarget(body);
  // Today, which used to pass no muscleFocus.
  const today = calculateProteinTarget({ ...body, manualG: null });

  assert.deepStrictEqual(goals, today, 'the goals screen and Today still disagree');
  assert.strictEqual(goals.basis, 'lean_mass', `basis is ${goals.basis}, not her body fat`);
  assert.strictEqual(goals.stepped, 'up');

  // AND NEITHER OF THE TWO NUMBERS SHE SAW IS THIS ONE, which is the point.
  // She was shown 82-98 (lean mass, step-up missing) and 101-123 (bodyweight
  // basis, stepped up). The right answer is lean mass WITH the step-up: 90-107.
  // It sits BETWEEN the two figures she photographed, so neither screen was
  // right and the bug was not "one of them was correct".
  assert.ok(goals.low > 82 && goals.low < 101, `${goals.low} is not between the two she saw`);
  assert.ok(goals.high > 98 && goals.high < 123, `${goals.high} is not between the two she saw`);
  return `${goals.low}-${goals.high}g on both, lean mass and stepped up`;
});

check('a surface that knows nothing about her body says nothing', () => {
  assert.strictEqual(
    calculateProteinTarget({ weightKg: null, bodyFatPct: null, muscleFocus: 'increase' }),
    null,
    'a target was invented with no weight'
  );
  return 'no weight, no number';
});

// ---- 5. the pause ---------------------------------------------------------
check('a pause lands on the maintenance range and never under it', () => {
  const body = { weightKg: 56.6, bodyFatPct: 27.6, muscleFocus: 'increase' };
  const training = calculateProteinTarget({ ...body, training: 'training' });
  const paused = calculateProteinTarget({ ...body, training: 'paused' });
  const plain = calculateProteinTarget({ ...body, muscleFocus: 'maintain' });

  assert.strictEqual(paused.stepped, 'held');
  assert.ok(paused.low < training.low, 'a pause did not come down from the step-up');
  assert.deepStrictEqual(
    { low: paused.low, high: paused.high },
    { low: plain.low, high: plain.high },
    'a pause does not land on the maintenance range'
  );
  return `${training.low}-${training.high}g becomes ${paused.low}-${paused.high}g, the maintenance range`;
});

check('not saying is not a pause', () => {
  // SILENCE MUST NOT HOLD THE STEP-UP BACK. Her Week is empty by her own
  // instruction and there is no log of a session anywhere, so if null were read
  // as "not training", choosing "less fat, more muscle" would change nothing
  // about what the app asked of her - which is the failure the step-up was built
  // to fix.
  const body = { weightKg: 56.6, bodyFatPct: 27.6, muscleFocus: 'increase' };
  assert.strictEqual(calculateProteinTarget({ ...body, training: null }).stepped, 'up');
  assert.strictEqual(calculateProteinTarget(body).stepped, 'up');
  return 'null steps up, with the assumption named';
});

check('a pause never touches a figure she set herself', () => {
  const manual = calculateProteinTarget({
    manualG: 120,
    weightKg: 56.6,
    bodyFatPct: 27.6,
    muscleFocus: 'increase',
    training: 'paused',
  });
  assert.strictEqual(manual.kind, 'manual');
  assert.strictEqual(manual.grams, 120);
  return 'her own number stands through a pause';
});

check('a stepped-up number says what it assumed', () => {
  // HER FLAG. "Flag when the user isn't currently training (injury, pause, etc.)
  // and show a lower maintenance protein range instead, with a note that it
  // steps up once training resumes."
  const body = { weightKg: 56.6, bodyFatPct: 27.6, muscleFocus: 'increase' };
  const up = proteinAssumptionNote(calculateProteinTarget({ ...body, training: null }));
  const held = proteinAssumptionNote(calculateProteinTarget({ ...body, training: 'paused' }));
  const plain = proteinAssumptionNote(
    calculateProteinTarget({ ...body, muscleFocus: 'maintain' })
  );

  assert.ok(/training/i.test(up), 'a stepped-up target does not name the training it assumes');
  assert.ok(/steps back up/i.test(held), 'a held target does not say it comes back');
  assert.strictEqual(plain, null, 'a plain range invented a caveat it does not need');
  return 'the assumption is on the figure, not in a disclaimer';
});

// ---- 6. the working panel ------------------------------------------------
check('the panel describes the number it is showing, not the goal it wishes for', () => {
  // It used to print its protein line from `intent.highProtein` - the intent's
  // WISH - while the figures beside it came from the sum, which knows whether
  // the wish was granted. During a pause that would have read "kept high"
  // above the maintenance range.
  const src = readFileSync('mobile/src/lib/body-intent.ts', 'utf8');
  const at = src.indexOf('const { proteinLow, proteinHigh');
  assert.ok(at > 0, 'the protein line has moved - has explainTarget been rewritten?');
  const block = src.slice(at, at + 1800);
  assert.ok(
    !/intent\.highProtein/.test(block),
    'the panel still decides its own protein wording from the intent rather than the sum'
  );
  assert.ok(
    /proteinStepped === 'held'/.test(block),
    'the panel has no wording for a paused training state'
  );
  return 'one decision, read from the sum';
});

// ---- 7. the pause and the calories ---------------------------------------
//
// Ruth: "more sedentary weeks should keep to the maintenance kcal and fine to be
// at the lower end of the protein target in those times."
const { BODY_INTENT_BY_KEY, explainTarget } = INTENT;

const body = {
  weightKg: 56,
  weightSource: 'measured',
  bmrKcal: 1123,
  tdeeKcal: 1740,
  activityWord: null,
  proteinLow: 90,
  proteinHigh: 107,
};

// Both calorie implementations, so a rule proved here is proved on both sides
// of the Next/Expo boundary rather than on whichever one the test imported.
const EXPO_CAL = await import(root + '/mobile/src/lib/calorie-target.ts');
const NEXT_CAL = await import(root + '/app/lib/daily-targets.ts');

const both = (params) => [
  EXPO_CAL.calculateCalorieTarget(params),
  NEXT_CAL.calculateCalorieTarget(params),
];

const BASE = { tdeeKcal: 1740, weightKg: 56, bmrKcal: 1123 };

check('building muscle does not add calories, and says so', () => {
  // REWRITTEN ON 4 OCTOBER 2026 (Ruth's decision A). It used to assert that
  // build_muscle produced a 150 kcal surplus and that a paused training state
  // took it away. Neither is true any more: nothing adds calories unless she has
  // asked to gain weight, so there is no surplus for a pause to remove.
  //
  // The property that survives, and matters more, is that choosing it still
  // CHANGES something - the protein - or the choice is decorative.
  const w = explainTarget({
    ...body,
    intent: BODY_INTENT_BY_KEY.build_muscle,
    proteinStepped: 'up',
  });
  assert.strictEqual(w.targetKcal, 1740, `building muscle moved her calories to ${w.targetKcal}`);
  const all = w.lines.join(' | ');
  assert.ok(/not over it/.test(all), 'it does not say the calories stay where they are');
  assert.ok(!/150 kcal/.test(all), 'it still quotes the old flat surplus');
  return 'protein moves, calories do not';
});

check('only gaining weight adds calories, scaled and capped', () => {
  // Her decision A, the other half: "Gain and Gain+Build use the
  // bodyweight-scaled surplus (about 0.25% a week, shown honestly on screen with
  // a ceiling and a stated kcal-per-kg constant)."
  const w = explainTarget({
    ...body,
    intent: BODY_INTENT_BY_KEY.gain_weight,
    proteinStepped: 'plain',
  });
  assert.ok(w.targetKcal > 1740, `gaining weight did not raise anything: ${w.targetKcal}`);
  const all = w.lines.join(' | ');
  assert.ok(/quarter of a percent/.test(all), 'the rate is not stated');
  assert.ok(/7,700 kcal to a kilo/.test(all), 'the energy constant is not stated');
  assert.ok(/never goes above 300/.test(all), 'the ceiling is not stated');
  assert.ok(/nothing to reach and no date/.test(all), 'it reads as a target to hit');
  return `${w.targetKcal} kcal, with the rule shown`;
});

check('the surplus scales with bodyweight and stops at the ceiling', () => {
  // A flat figure is a different thing at 50 kg and at 100 kg; an unbounded
  // scale is a different problem. Both are checked rather than described.
  assert.ok(gainSurplusKcal(50) < gainSurplusKcal(90), 'the surplus does not scale');
  assert.strictEqual(gainSurplusKcal(200), 300, 'the ceiling does not bind');
  assert.ok(gainSurplusKcal(56.55) < 200, 'her own surplus is not gentle');
  return `${gainSurplusKcal(56.55)} kcal at 56.55 kg, 300 at the top`;
});

check('Pause puts every combination at what she uses', () => {
  // One rule, checked across every focus pair rather than described once.
  for (const [fat, muscle] of [
    ['reduce', 'maintain'], ['reduce', 'increase'], ['maintain', 'maintain'],
    ['maintain', 'increase'], ['increase', 'maintain'], ['increase', 'increase'],
  ]) {
    const [a] = both({ ...BASE, fatFocus: fat, muscleFocus: muscle, paused: true });
    assert.strictEqual(a.targetKcal, 1740, `${fat}/${muscle} paused to ${a.targetKcal}`);
    assert.strictEqual(a.heldBecause, 'paused');
  }
  return 'six combinations, one place';
});

check('a paused deficit holds at maintenance without touching the goal', () => {
  const [on] = both({ ...BASE, fatFocus: 'reduce', muscleFocus: 'maintain', deficitState: 'on' });
  const [off] = both({ ...BASE, fatFocus: 'reduce', muscleFocus: 'maintain', deficitState: 'paused' });
  assert.strictEqual(on.mode, 'deficit');
  assert.strictEqual(off.mode, 'maintenance');
  assert.strictEqual(off.targetKcal, 1740, 'a paused deficit is not maintenance');
  assert.strictEqual(off.heldBecause, 'deficit_paused');
  assert.ok(off.targetKcal > on.targetKcal, 'pausing did not raise the target');
  return `${on.targetKcal} becomes ${off.targetKcal}, goal untouched`;
});

check('a paused deficit needs no bodyweight', () => {
  // The deficit branch returns null without a weight. A pause is just
  // maintenance, so it must not inherit that requirement and leave her with no
  // target at all while she is away.
  const [off] = both({
    ...BASE,
    weightKg: null,
    fatFocus: 'reduce',
    muscleFocus: 'maintain',
    deficitState: 'paused',
  });
  assert.ok(off != null, 'a paused deficit with no weight produced no target');
  assert.strictEqual(off.targetKcal, 1740);
  return 'still a figure';
});

check('the two pauses do not do each other\'s job', () => {
  // A holiday is no reason to drop her protein; an injury is no reason to stop a
  // deficit. If either switch starts moving the other one's number, the reason
  // she gave has been quietly reinterpreted.
  const body = { weightKg: 56, bodyFatPct: 27.6, muscleFocus: 'increase' };
  const holiday = calculateProteinTarget({ ...body, training: null });
  assert.strictEqual(holiday.stepped, 'up', 'pausing a deficit moved her protein');

  const [injured] = both({
    ...BASE,
    fatFocus: 'reduce',
    muscleFocus: 'maintain',
    training: 'paused',
  });
  assert.strictEqual(injured.mode, 'deficit', 'pausing training cancelled her deficit');
  return 'one switch, one effect';
});

check('a deficit says what it means per week', () => {
  // Ruth: "explain roughly what that means in terms of fat loss expected per week
  // and how that relates to the kcal deficit daily and per week."
  const w = explainTarget({
    intent: BODY_INTENT_BY_KEY.lose_fat,
    weightKg: 56,
    weightSource: 'measured',
    bmrKcal: 1123,
    tdeeKcal: 1740,
    activityWord: null,
    proteinLow: 90,
    proteinHigh: 107,
    proteinStepped: 'plain',
    deficitPaused: false,
  });
  const all = w.lines.join(' | ');
  assert.ok(/this is a deficit/i.test(all), 'it never says there is a deficit');
  assert.ok(/across a week/.test(all), 'the weekly figure is missing');
  assert.ok(/kg a week/.test(all), 'the expected loss is missing');
  assert.ok(/direction rather than a schedule/.test(all), 'it reads as a promise');
  return 'daily, weekly, and roughly how much';
});

check('the expected loss follows the floor, not the intention', () => {
  // When the floor bites the real deficit is smaller, and quoting the rate that
  // was ASKED for would be the app promising a result its own arithmetic refused.
  const w = explainTarget({
    intent: BODY_INTENT_BY_KEY.lose_fat,
    weightKg: 56,
    weightSource: 'measured',
    bmrKcal: 1400,
    tdeeKcal: 1500,
    activityWord: null,
    proteinLow: 90,
    proteinHigh: 107,
    proteinStepped: 'plain',
    deficitPaused: false,
  });
  assert.strictEqual(w.flooredAt, 1400, 'the floor did not bite in this case');
  const stated = /about ([0-9.]+) kg a week/.exec(w.lines.join(' | '));
  assert.ok(stated, 'no expected loss stated');
  // 1500 - 1400 = 100 kcal/day -> 700/week -> 0.09 kg, not the 0.28 asked for.
  assert.ok(
    Number(stated[1]) < 0.15,
    `${stated[1]} kg is the rate that was asked for, not the one the floor allows`
  );
  return `${stated[1]} kg a week, the deficit that survived the floor`;
});

check('a paused deficit explains itself and keeps the goal', () => {
  const w = explainTarget({
    intent: BODY_INTENT_BY_KEY.lose_fat,
    weightKg: 56,
    weightSource: 'measured',
    bmrKcal: 1123,
    tdeeKcal: 1740,
    activityWord: null,
    proteinLow: 90,
    proteinHigh: 107,
    proteinStepped: 'plain',
    deficitPaused: true,
  });
  const all = w.lines.join(' | ');
  assert.strictEqual(w.targetKcal, 1740, 'a paused deficit still eats under maintenance');
  // THE PROPERTY IS UNCHANGED, THE WORD IS NOT: a paused deficit must still say
  // the thing she chose survives the pause. It is her approach now, not her goal.
  assert.ok(/still your approach/.test(all), 'it does not say the approach survives');
  assert.ok(!/your goal/.test(all), 'a paused deficit still calls it a goal');
  assert.ok(!/this is a deficit/i.test(all), 'it still calls a paused target a deficit');
  return 'maintenance, and the goal stays';
});

// ---- 9. chat is told how the figures were reached -------------------------
check('chat is given the working, not a second version of it', () => {
  const src = readFileSync('app/lib/daily-targets.ts', 'utf8');
  assert.ok(
    /HOW THAT GUIDE WAS WORKED OUT/.test(src),
    'the chat prompt carries the guide with no account of where it came from, ' +
      'so the one surface she can ask a question on cannot answer it'
  );
  assert.ok(
    /explainTarget\(/.test(src),
    'the prompt builds its own description instead of using explainTarget - two ' +
      'wordings of one number is the bug this file exists for'
  );
  assert.ok(
    /heldBecause === 'deficit_paused'/.test(src),
    'chat is never told a paused deficit is a pause, so it can only read it as her ' +
      'having given up what she chose'
  );
  return 'the same sentences the screen shows';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
