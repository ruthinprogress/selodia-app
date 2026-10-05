// HER COPY IS THE RECORD, AND NOTHING MAY PARAPHRASE IT.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-starting-guide.mjs
//
// Ruth, 5 October 2026: "Add the 'Your starting guide' text block I pasted to the
// matrix as the permanent record: one 'text shown on screen' entry per state
// (ten), with the frame, the italic lines and the placeholders as written. The
// checks read it. Do not paraphrase it."
//
// WHY A CHECK AND NOT A CONVENTION. Every piece of copy in this app that was only
// a convention has drifted: the activity phrase lived in three vocabularies, the
// matrix builder kept "the level you have set" alive for a day after the app
// stopped saying it, and two checks were pinned to MY sentences so her
// improvements registered as regressions. This reads her text from one module,
// compares it with the generated record, and holds the handful of properties she
// stated about it.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const GUIDE = await import(root + '/mobile/src/lib/starting-guide.ts');

const matrix = JSON.parse(readFileSync('scripts/mode-matrix.json', 'utf8'));

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

console.log('\n  YOUR STARTING GUIDE: THE RECORD AND THE SCREEN\n');

check('the matrix carries all ten states', () => {
  const rec = matrix.startingGuide;
  assert.ok(rec, 'the matrix has no startingGuide record at all');
  assert.strictEqual(rec.states.length, 10, `${rec.states.length} states, not ten`);
  const keys = rec.states.map((s) => s.key);
  assert.deepStrictEqual(
    keys,
    GUIDE.GUIDE_STATES.map((g) => g.key),
    'the record lists different states from the module, or lists them in a different order'
  );
  return 'ten, in her order';
});

check('not one word of the record differs from the module', () => {
  // THE WHOLE POINT. "Do not paraphrase it." A single reworded sentence anywhere
  // between her message and the screen fails here, whichever end it was changed
  // at - the record is generated from the module, so this catches a stale matrix
  // as readily as an edited sentence.
  const bad = [];
  for (const g of GUIDE.GUIDE_STATES) {
    const r = matrix.startingGuide.states.find((s) => s.key === g.key);
    if (!r) {
      bad.push(`${g.key}: missing from the record`);
      continue;
    }
    if (r.paragraph !== g.paragraph) bad.push(`${g.key}: the paragraph differs`);
    if ((r.italic ?? null) !== (g.italic ?? null)) bad.push(`${g.key}: the italic line differs`);
    if ((r.smallLine ?? null) !== (g.smallLine ?? null)) bad.push(`${g.key}: the small line differs`);
  }
  for (const [k, v] of Object.entries(GUIDE.GUIDE_FRAME)) {
    if (matrix.startingGuide.frame[k] !== v) bad.push(`frame.${k} differs`);
  }
  assert.ok(bad.length === 0, bad.join('\n          '));
  return 'the record is the module, word for word';
});

check('every state names what it shows on screen', () => {
  for (const s of matrix.startingGuide.states) {
    assert.ok(Array.isArray(s.shownOnScreen), `${s.key} has no shownOnScreen`);
    assert.ok(s.shownOnScreen.length >= 5, `${s.key} shows only ${s.shownOnScreen.length} lines`);
    assert.strictEqual(s.shownOnScreen[0], GUIDE.GUIDE_FRAME.title, `${s.key} does not open with the title`);
    assert.ok(
      s.shownOnScreen.includes(s.paragraph),
      `${s.key} does not show its own paragraph`
    );
  }
  return 'title, frame, paragraph, and whatever else she wrote for it';
});

check('the placeholders are exactly the ones she wrote', () => {
  // HER BRACES, UNRENAMED. The app fills them; it does not get to rename them,
  // because the record is what somebody reads to know what the screen says.
  const want = {
    restBullet: ['resting'],
    activityBullet: ['activity phrase', 'activity kcal'],
    guideFigure: ['guide'],
    proteinFigure: ['protein low', 'protein high'],
  };
  for (const [key, names] of Object.entries(want)) {
    const found = [...GUIDE.GUIDE_FRAME[key].matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
    assert.deepStrictEqual(found, names, `${key} has placeholders ${JSON.stringify(found)}`);
  }
  for (const key of ['gain', 'gain_build']) {
    assert.ok(
      GUIDE.GUIDE_BY_KEY[key].paragraph.includes('{surplus}'),
      `${key} no longer names the surplus`
    );
  }
  return 'resting, activity phrase, activity kcal, guide, protein low, protein high, surplus';
});

check('the two italic lines differ by the word that makes them true', () => {
  // HERS, AND THE DIFFERENCE IS THE POINT: "not simply from eating less" under a
  // deficit, "not simply from eating more" when she is holding steady. One line
  // reused for both would be wrong in one of them.
  assert.ok(
    GUIDE.GUIDE_BY_KEY.lose_fat_build.italic.endsWith('not simply from eating less.'),
    'the lose-fat italic no longer ends "eating less"'
  );
  assert.ok(
    GUIDE.GUIDE_BY_KEY.maintain_build.italic.endsWith('not simply from eating more.'),
    'the maintain italic no longer ends "eating more"'
  );
  return 'less under a deficit, more while holding steady';
});

check('the italic line appears only where she put one', () => {
  const withItalic = GUIDE.GUIDE_STATES.filter((g) => g.italic).map((g) => g.key);
  assert.deepStrictEqual(
    withItalic,
    ['lose_fat_build', 'maintain_build', 'build'],
    `the serif line is on ${withItalic.join(', ')}`
  );
  return 'three states, and not Lose fat alone or Gain weight';
});

check('the doctor line is on both gain states and nowhere else', () => {
  const withSmall = GUIDE.GUIDE_STATES.filter((g) => g.smallLine).map((g) => g.key);
  assert.deepStrictEqual(withSmall, ['gain', 'gain_build'], `it is on ${withSmall.join(', ')}`);
  return 'where gaining is chosen, and only there';
});

check('the two states with no guide show no figures', () => {
  for (const key of ['none', 'no_weight']) {
    const s = matrix.startingGuide.states.find((x) => x.key === key);
    assert.strictEqual(s.showsFigures, false, `${key} shows the figures block`);
    assert.ok(
      !s.shownOnScreen.includes(GUIDE.GUIDE_FRAME.guideFigure),
      `${key} shows a kcal figure it does not have`
    );
    assert.ok(
      s.shownOnScreen.includes(GUIDE.GUIDE_FRAME.closingNoGuide),
      `${key} does not close with "Nothing here is fixed."`
    );
  }
  return 'no approach and no weight both say so instead of showing a number';
});

check('no em dashes anywhere in her copy', () => {
  // Her standing rule for anything in her voice.
  const offenders = [];
  for (const g of GUIDE.GUIDE_STATES) {
    for (const t of [g.paragraph, g.italic, g.smallLine, g.teaches]) {
      if (t && t.includes('—')) offenders.push(g.key);
    }
  }
  for (const [k, v] of Object.entries(GUIDE.GUIDE_FRAME)) {
    if (typeof v === 'string' && v.includes('—')) offenders.push(`frame.${k}`);
  }
  assert.ok(offenders.length === 0, `em dashes in ${[...new Set(offenders)].join(', ')}`);
  return 'none';
});

check('every reachable combination resolves to one of her states', () => {
  // A combination with no state would render an empty panel, which is the one
  // outcome worse than the wrong words.
  const seen = new Set();
  for (const loseFat of [false, true]) {
    for (const maintainWeight of [false, true]) {
      for (const gainWeight of [false, true]) {
        for (const buildMuscle of [false, true]) {
          const weightsOn = [loseFat, maintainWeight, gainWeight].filter(Boolean).length;
          if (weightsOn > 1) continue; // the UI and withToggle both forbid it
          const mode = { loseFat, maintainWeight, gainWeight, buildMuscle };
          const state = GUIDE.guideStateFor({ mode, paused: false, weightKnown: true });
          assert.ok(state, `no state for ${JSON.stringify(mode)}`);
          seen.add(state.key);
        }
      }
    }
  }
  assert.ok(seen.has('none'), 'nothing chosen does not resolve to the no-approach state');
  return `${seen.size} states reached from the switches`;
});

check('a pause and a missing weight win over the switches', () => {
  const mode = { loseFat: true, maintainWeight: false, gainWeight: false, buildMuscle: true };
  assert.strictEqual(
    GUIDE.guideStateFor({ mode, paused: true, weightKnown: true }).key,
    'paused',
    'a paused account still shows its approach paragraph'
  );
  assert.strictEqual(
    GUIDE.guideStateFor({ mode, paused: true, weightKnown: false }).key,
    'no_weight',
    'without a weight there is still a guide'
  );
  return 'no weight first, then paused, then the switches';
});

check('and this check can fail', () => {
  // A check whose assertions are trivially true reports PASS for the thing it is
  // not testing. The comparison is run here against a paraphrase of her own
  // sentence, which must be caught.
  const real = GUIDE.GUIDE_BY_KEY.lose_fat.paragraph;
  const paraphrased = real.replace('gentle calorie deficit', 'small calorie deficit');
  assert.notStrictEqual(paraphrased, real, 'the fixture did not change anything');
  assert.ok(
    paraphrased !== GUIDE.GUIDE_BY_KEY.lose_fat.paragraph,
    'a paraphrase compares equal to her wording'
  );
  return 'a reworded sentence is detected';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
