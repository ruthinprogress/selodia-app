// IS THE COLOUR ON THAT TILE TELLING HER THE TRUTH?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-where-the-day-stands.mjs
//
// Ruth, 23 October 2026, on a food log that showed her averages and nothing
// else: "I can't tell that from a glance and that's actually not very good body
// litaracy training... I actually don't think it's a nice to have - it's the
// missing piece that was making it feel pointless and a chore."
//
// The grid is the answer to that, and it is the most dangerous thing on the
// screen, because a coloured tile is read as a FACT about her body in a way a
// row of numbers never is. Six ways it can lie, in the order they would happen:
//
//  1. A UNIT MISMATCH. Salt is stored as sodium in milligrams and shown as
//     grams of salt. The first version of the reference was a 2,400 ceiling
//     against a figure already divided by 2.5, so a 6 g salt day arrived as the
//     number 2.4 and came back "in range" - the one nutrient that could never
//     turn, with no symptom at all.
//  2. A GUIDELINE READ BACK AS HER TARGET. A population figure she never agreed
//     to, labelled "target", is a goal acquired by accident. Two of these ten
//     are hers and eight are not.
//  3. AN INVENTED COMPARISON. Carbohydrate has no published daily gram figure
//     and total sugar cannot be measured against a free-sugar limit. A tile
//     that guesses looks exactly like the eight that do not.
//  4. COLOUR AS THE ONLY CUE. Four hues and no words is a grid that says
//     nothing to the one reader in twelve who cannot separate them.
//  5. A MARK NOBODY CAN SEE. The tiles are sand - which is what every card in
//     this app sits on, and what she asked for. Against sand the drawn values
//     measure as low as 2.02:1, under the 3.0 floor for a mark. The colour has
//     to reach the ICON as well as the bar, because a charcoal icon was the one
//     thing she specifically rejected, so a faint colour fails twice.
//  6. A FALLBACK THAT CANNOT RUN. `<Grid /> ?? <Line />` is dead code, because
//     a JSX element is never null, and the day with no figures shows a gap.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
// nutrient-profile.ts is NOT imported here, and that is deliberate: it reaches
// Supabase and so reaches react-native, which plain node cannot parse. The type
// it fills and the age sum that feeds it live in nutrient-standing.ts for
// exactly that reason, so everything below is reachable.
const S = await import(root + '/mobile/src/lib/nutrient-standing.ts');
const M = await import(root + '/mobile/src/lib/tracked-macros.ts');

const read = (p) => readFileSync(p, 'utf8').replace(/\r/g, '');
const GRID = read('mobile/src/components/nutrient-grid.tsx');
const VIEW = read('mobile/src/components/food-log-view.tsx');
const THEME = read('mobile/src/constants/theme.ts');

let passed = 0;
const failed = [];
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed.push(name);
    console.log(`  FAIL  ${name}: ${e.message}`);
  }
}

/** Her own figures, as a real profile would arrive. */
const HERS = { ageYears: 44, targetKcal: 1800, proteinLow: 100, proteinHigh: 120 };

const standing = (key, row, profile = HERS) =>
  S.standingFor(M.macroAmount(key, row), S.referenceFor(key, profile));

// -- 1. the unit a comparison is made in ------------------------------------

check('salt is judged in grams of salt, not milligrams of sodium', () => {
  // A gram of salt is 400 mg of sodium, so the 6 g guideline is 2,400 mg.
  // 2,600 is a salty day and must turn.
  assert.equal(standing('salt', { sodium_mg: 2600 }), 'higher');
  // 800 mg of sodium is 2 g of salt, which is well under it.
  assert.equal(standing('salt', { sodium_mg: 800 }), 'in-range');
});

check('a salt day over the guideline can never read in range', () => {
  // THE SHAPE OF THE OLD BUG, caught by arithmetic rather than by a number.
  // Anything above the ceiling must turn, whatever the figure happens to be.
  const ref = S.referenceFor('salt', HERS);
  assert.equal(S.standingFor(ref.shape.value * 1.2, ref), 'higher');
  // And the stored column, converted, must land in the ceiling's own unit. If
  // these two ever drift apart again, salt becomes the one nutrient on the grid
  // that cannot turn, with no symptom at all.
  const grams = M.macroAmount('salt', { sodium_mg: 2400 });
  assert.ok(
    Math.abs(grams - ref.shape.value) < 0.5,
    `2,400 mg of sodium is 6 g of salt, but it came through as ${grams} against a ceiling of ${ref.shape.value}`
  );
});

check('the figure on the tile and the value being judged are the same number', () => {
  // A tile reading "5.2 g" coloured from the raw 13,000 would be the unit bug
  // again, one layer up. Both must come off macroAmount.
  assert.match(GRID, /macroAmount\(spec\.key, values\)/);
  assert.ok(
    !/values\[\s*spec\.column\s*\]/.test(GRID),
    'the grid is reading the raw column, which for salt is sodium in milligrams'
  );
});

// -- 2. whose figure it is --------------------------------------------------

check('only the two she set herself are called a target', () => {
  for (const key of ['kcal', 'protein']) {
    assert.equal(S.referenceFor(key, HERS).kind, 'target', `${key} should be hers`);
  }
  for (const key of ['fibre', 'calcium', 'iron', 'salt', 'saturated', 'fat']) {
    assert.equal(
      S.referenceFor(key, HERS).kind,
      'guideline',
      `${key} is a published figure and must never read as her target`
    );
  }
});

check('every published figure names whose it is', () => {
  for (const key of ['fibre', 'calcium', 'iron', 'salt', 'saturated', 'fat']) {
    const ref = S.referenceFor(key, HERS);
    assert.ok(ref.source && ref.source.length > 1, `${key} has no source`);
    assert.ok(ref.stated && /\d/.test(ref.stated), `${key} does not state a number`);
  }
});

check('the tile prints the word guideline or target, never bare', () => {
  assert.match(GRID, /reference\.kind === 'target' \? 'target' : 'guideline'/);
  assert.match(GRID, /\$\{reference\.stated\} · \$\{reference\.source\} \$\{kind\}/);
});

// -- 3. nothing is invented -------------------------------------------------

check('carbohydrate and total sugar get no comparison at all', () => {
  for (const key of ['carbs', 'sugar']) {
    assert.equal(S.referenceFor(key, HERS), null, `${key} must have no reference`);
    assert.equal(standing(key, { carbs_g: 400, sugar_g: 300 }), null);
  }
});

check('iron waits for an age rather than guessing which figure applies', () => {
  assert.equal(S.referenceFor('iron', { ...HERS, ageYears: null }), null);
  assert.equal(S.referenceFor('iron', { ...HERS, ageYears: 44 }).shape.value, 14.8);
  assert.equal(S.referenceFor('iron', { ...HERS, ageYears: 62 }).shape.value, 8.7);
});

check('her two targets disappear when she has not set them', () => {
  const blank = S.NO_NUTRIENT_PROFILE;
  assert.equal(S.referenceFor('kcal', blank), null);
  assert.equal(S.referenceFor('protein', blank), null);
  // And the published eight are unaffected by her having no profile.
  assert.notEqual(S.referenceFor('fibre', blank), null);
});

check('a tile with no reference still appears, grey, and says why', () => {
  assert.match(GRID, /No guideline/);
  assert.match(GRID, /Nothing published to compare this to/);
  // It is included on the strength of a FIGURE, not of a reference.
  assert.match(GRID, /if \(figure == null\) continue;/);
});

// -- 4. the colour is never the only cue -----------------------------------

check('every tile carries the word as well as the bar', () => {
  assert.match(GRID, /STANDING_LABEL\[tile\.standing\]/);
  // And a listener gets the state spoken, since a bar carries no text.
  assert.match(GRID, /accessibilityLabel=/);
  assert.match(GRID, /STANDING_LABEL\[tile\.standing\]\.toLowerCase\(\)/);
});

check('the icon is the standing colour, never charcoal', () => {
  // Ruth, 23 October 2026: "I rejected a charcoal text for the icon." A mark
  // that is the same grey on every tile reads as decoration, and leaves a
  // four-pixel bar as the only thing carrying the state.
  assert.match(GRID, /color=\{tile\.standing \? STANDING_COLOUR\[tile\.standing\] : undefined\}/);
});

check('the legend shows only the states actually drawn', () => {
  assert.match(GRID, /tiles\.some\(\(t\) => t\.standing === s\)/);
});

check('her four words are the only words for the four states', () => {
  assert.deepEqual(S.STANDING_LABEL, {
    'in-range': 'In range',
    'a-little-low': 'A little low',
    lower: 'Lower',
    higher: 'Higher',
  });
});

// -- 5. a mark somebody can see -------------------------------------------

/** The relative luminance of a hex colour. */
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
const contrast = (a, b) => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** CIE L*a*b*, so two colours can be compared as colours rather than as light. */
function lab(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(lin);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
  const Y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
  const Z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

/** How far apart two colours are to an eye. Under about 10 reads as the same. */
function difference(a, b) {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Sand, read out of the palette rather than copied, so a repaint moves this. */
const SAND = (THEME.match(/backgroundElement: '(#[0-9A-Fa-f]{6})'/) ?? [])[1];

check('sand was found in the palette, so the floor below means something', () => {
  assert.ok(SAND, 'backgroundElement is no longer a plain hex in theme.ts');
});

check('every standing colour clears 3 to 1 against the card it sits on', () => {
  for (const [state, colour] of Object.entries(S.STANDING_COLOUR)) {
    const ratio = contrast(colour, SAND);
    assert.ok(ratio >= 3, `${state} ${colour} measures ${ratio.toFixed(2)}:1 on sand`);
  }
});

check('the four colours are four, not three and a near-duplicate', () => {
  const states = Object.keys(S.STANDING_COLOUR);
  assert.equal(new Set(Object.values(S.STANDING_COLOUR)).size, 4);
  // MEASURED AS COLOUR DIFFERENCE, NOT AS LIGHTNESS. The first version of this
  // demanded a 10% luminance step between neighbours, which the four could only
  // meet by becoming a dark-to-light ladder - and the only set that satisfied it
  // had three of the four collapsed onto the same muddy brown, distinguishable
  // by lightness and nothing else. That is a worse palette AND a worse test: it
  // threw away the hues she chose in order to pass a rule nobody asked for.
  //
  // Twelve is the line because her own drawn set's closest pair measures 16.4,
  // so this holds the spacing she drew with room for a repaint, and rejects two
  // colours that genuinely read as one.
  for (let i = 0; i < states.length; i += 1) {
    for (let j = i + 1; j < states.length; j += 1) {
      const d = difference(S.STANDING_COLOUR[states[i]], S.STANDING_COLOUR[states[j]]);
      assert.ok(d >= 12, `${states[i]} and ${states[j]} differ by only ${d.toFixed(1)}`);
    }
  }
});

check('one green, which is why she chose this colourway', () => {
  // Ruth: "i associate green with good, reds with bad, so it's a bit confusing
  // to have greens as a little low." Green on two states is green doing two
  // jobs, and neither reads.
  const greens = Object.values(S.STANDING_COLOUR).filter((hex) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return g > r && g > b;
  });
  assert.equal(greens.length, 1, `${greens.length} colours read as green`);
});

// -- 6. the fallback can run ----------------------------------------------

check('the empty day falls back through a predicate, not through JSX', () => {
  assert.match(VIEW, /hasNutrientTiles\(totals, tracked\) \?/);
  assert.ok(
    !/\/>\s*\)\s*\?\?/.test(VIEW),
    'a JSX element is never null, so `<Grid /> ?? <Line />` is dead code'
  );
});

check('the predicate agrees with what the grid would draw', () => {
  // Both read the same figures through the same filter, so they cannot disagree
  // about whether there is anything to show.
  assert.match(GRID, /export function hasNutrientTiles/);
  assert.match(GRID, /return tilesFor\(/);
});

check('the day is summed once and read three times', () => {
  assert.match(VIEW, /const totals = sumRows\(/);
  assert.match(VIEW, /values=\{totals\}/);
  assert.match(VIEW, /macroLine\(totals, tracked\)/);
});

// -- 7. where the bands fall ----------------------------------------------

check('four fifths of a floor is a little low, and below it is lower', () => {
  const fibre = S.referenceFor('fibre', HERS); // 30 g
  assert.equal(S.standingFor(31, fibre), 'in-range');
  assert.equal(S.standingFor(30, fibre), 'in-range');
  assert.equal(S.standingFor(24, fibre), 'a-little-low'); // exactly 0.8
  assert.equal(S.standingFor(23.9, fibre), 'lower');
});

check('a ceiling has no a-little-high, because just under it is simply under', () => {
  const sat = S.referenceFor('saturated', HERS); // 20 g
  assert.equal(S.standingFor(19.9, sat), 'in-range');
  assert.equal(S.standingFor(20, sat), 'in-range');
  assert.equal(S.standingFor(20.1, sat), 'higher');
});

check('her protein band turns at both ends', () => {
  const protein = S.referenceFor('protein', HERS); // 100-120
  assert.equal(S.standingFor(110, protein), 'in-range');
  assert.equal(S.standingFor(125, protein), 'higher');
  assert.equal(S.standingFor(85, protein), 'a-little-low');
  assert.equal(S.standingFor(60, protein), 'lower');
});

check('a typed protein figure is a band of one, not a floor', () => {
  // She can type a single number instead of taking the range. Treating it as a
  // floor would mark double her protein "in range", which is not what somebody
  // who typed one number meant.
  const one = S.referenceFor('protein', { ...HERS, proteinLow: 110, proteinHigh: 110 });
  assert.equal(S.standingFor(110, one), 'in-range');
  assert.equal(S.standingFor(140, one), 'higher');
});

check('nothing logged is no standing, never a zero in range', () => {
  const fibre = S.referenceFor('fibre', HERS);
  assert.equal(S.standingFor(null, fibre), null);
  assert.equal(S.standingFor(undefined, fibre), null);
  assert.equal(S.standingFor(NaN, fibre), null);
  // A real zero is a real answer, though, and it is not "in range" for a floor.
  assert.equal(S.standingFor(0, fibre), 'lower');
});

// -- 8. her age, which decides the iron figure ----------------------------

check('age comes off the date of birth and nothing else', () => {
  const now = new Date('2026-10-23T12:00:00Z');
  assert.equal(S.ageFrom('1982-03-01', now), 44);
  // The birthday has not happened yet this year.
  assert.equal(S.ageFrom('1982-12-01', now), 43);
  assert.equal(S.ageFrom(null, now), null);
  assert.equal(S.ageFrom('not a date', now), null);
});

// -- every case above must be able to fail -------------------------------

const useless = [];
function mustFail(name, fn) {
  try {
    fn();
    useless.push(name);
  } catch {
    /* threw, which is the point */
  }
}

mustFail('salt in the wrong unit', () =>
  // The bug as it was: a 2,400 ceiling against grams of salt.
  assert.equal(
    S.standingFor(M.macroAmount('salt', { sodium_mg: 16250 }), {
      shape: { kind: 'ceiling', value: 2400 },
      kind: 'guideline',
      source: 'NHS',
      stated: 'x',
    }),
    'higher'
  )
);

mustFail('a guideline called a target', () =>
  assert.equal(S.referenceFor('fibre', HERS).kind, 'target')
);

mustFail('carbohydrate given a number', () =>
  assert.notEqual(S.referenceFor('carbs', HERS), null)
);

mustFail('iron guessed without an age', () =>
  assert.notEqual(S.referenceFor('iron', { ...HERS, ageYears: null }), null)
);

mustFail('a colour too faint to see', () =>
  assert.ok(contrast('#A89684', SAND) >= 3, 'the drawn a-little-low on sand')
);

mustFail('two colours that read as one', () =>
  // Brand sage against the drawn in-range: two greens a hair apart.
  assert.ok(difference('#7C8C6A', '#95A987') >= 12)
);

mustFail('two greens', () => {
  const greens = ['#7C8C6A', '#95A987'].filter((hex) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return g > r && g > b;
  });
  assert.equal(greens.length, 1);
});

mustFail('a zero read as in range', () =>
  assert.equal(S.standingFor(0, S.referenceFor('fibre', HERS)), 'in-range')
);

mustFail('a typed protein figure read as a floor', () =>
  assert.equal(
    S.standingFor(140, S.referenceFor('protein', { ...HERS, proteinLow: 110, proteinHigh: 110 })),
    'in-range'
  )
);

mustFail('the dead JSX fallback accepted', () =>
  // The assertion above, run against the bug as it was actually written. It has
  // to THROW on this, or it is a check that could never have caught it.
  assert.ok(
    !/\/>\s*\)\s*\?\?/.test('openSummary: (\n  <NutrientGrid values={totals} />\n) ?? (\n'),
    'the dead fallback'
  )
);

mustFail('a missing word beside the colour', () =>
  assert.doesNotMatch(GRID, /STANDING_LABEL\[tile\.standing\]/)
);

mustFail('a charcoal icon accepted', () =>
  // The icon as it was first written, taking the theme's secondary grey on
  // every tile.
  assert.match(
    '<NutrientIcon macroKey={tile.key} size={16} />',
    /color=\{tile\.standing \? STANDING_COLOUR\[tile\.standing\] : undefined\}/
  )
);

console.log('');
for (const name of useless) console.log(`  USELESS  ${name} passed on broken input`);
console.log(
  `\n  ${passed} passed, ${failed.length} failed, ${useless.length} useless\n`
);
if (failed.length > 0 || useless.length > 0) process.exit(1);
