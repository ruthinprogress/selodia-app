// IS THAT COLOURED MARK TELLING HER THE TRUTH?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-where-the-day-stands.mjs
//
// Ruth, 23 October 2026, on a food log that showed her averages and nothing
// else: "I can't tell that from a glance and that's actually not very good body
// litaracy training... it's the missing piece that was making it feel pointless
// and a chore."
//
// REWRITTEN 24 OCTOBER, when the first build came back from her phone wrong in
// almost every respect: "the main screen is nothing like the artwork, the
// follow through screens weren't make, just pointed to the generic list of
// nutrients we already had."
//
// Her artwork says three things this file now holds:
//
//   "Icon colour shows how you're doing."    the mark is the ONLY cue on the
//                                            grid - no bar, no word, no
//                                            sentence. "this is not calm" was
//                                            her verdict on having all three.
//   a chevron into the nutrient's own screen not into the glossary
//   a lighter square inside the card         which is what makes her colourway
//                                            legible without changing it
//
// Seven ways it can lie, in the order they would happen:
//
//  1. A UNIT MISMATCH. Salt is stored as sodium in milligrams and shown as
//     grams of salt. The first version compared grams to a milligram ceiling,
//     so a 6 g salt day read "in range" - the one nutrient that could never
//     turn, with no symptom at all.
//  2. A GUIDELINE READ BACK AS HER TARGET. A population figure she never
//     agreed to, labelled "target", is a goal acquired by accident.
//  3. AN INVENTED COMPARISON. Carbohydrate has no published daily gram figure
//     and total sugar cannot be measured against a free-sugar limit.
//  4. A MARK NOBODY CAN SEE. The colour is now the only cue on the grid, so
//     the 3:1 floor is not a nicety - and it must be measured against the
//     surface the mark is ACTUALLY drawn on.
//  5. COLOUR WITH NO WAY TO LEARN IT. The word moved off the cell, so the
//     legend behind the "i" is the only place the four states are named.
//  6. A CHEVRON INTO THE GLOSSARY. The thing she called out by name.
//  7. TWO WEEK STEPPERS. The card and the list below it would each hold their
//     own idea of the week.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
// nutrient-profile.ts is NOT imported: it reaches Supabase and so reaches
// react-native, which plain node cannot parse. The type it fills and the age
// sum live in nutrient-standing.ts for exactly that reason.
const S = await import(root + '/mobile/src/lib/nutrient-standing.ts');
const M = await import(root + '/mobile/src/lib/tracked-macros.ts');
const C = await import(root + '/mobile/src/lib/nutrient-citations.ts');

const read = (p) => readFileSync(p, 'utf8').replace(/\r/g, '');
const GRID = read('mobile/src/components/nutrient-grid.tsx');
const CARD = read('mobile/src/components/week-average-card.tsx');
const SCREEN = read('mobile/src/app/(tabs)/log/nutrient/[key].tsx');
const VIEW = read('mobile/src/components/food-log-view.tsx');
const DAYLOG = read('mobile/src/components/day-log.tsx');
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
const HERS = {
  ageYears: 44,
  targetKcal: 1800,
  proteinLow: 100,
  proteinHigh: 120,
  stillBleeding: true,
};

const standing = (key, row, profile = HERS) =>
  S.standingFor(M.macroAmount(key, row), S.referenceFor(key, profile));

// -- 1. the unit a comparison is made in ------------------------------------

check('salt is judged in grams of salt, not milligrams of sodium', () => {
  // A gram of salt is 400 mg of sodium, so the 6 g guideline is 2,400 mg.
  assert.equal(standing('salt', { sodium_mg: 2600 }), 'higher');
  assert.equal(standing('salt', { sodium_mg: 800 }), 'in-range');
});

check('a salt day over the guideline can never read in range', () => {
  const ref = S.referenceFor('salt', HERS);
  assert.equal(S.standingFor(ref.shape.value * 1.2, ref), 'higher');
  const grams = M.macroAmount('salt', { sodium_mg: 2400 });
  assert.ok(
    Math.abs(grams - ref.shape.value) < 0.5,
    `2,400 mg of sodium is 6 g of salt, but it came through as ${grams} against a ceiling of ${ref.shape.value}`
  );
});

check('the figure on the cell and the value being judged are the same number', () => {
  assert.match(GRID, /macroAmount\(key, values\)/);
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

check('the nutrient screen says target or guideline, never bare', () => {
  // THIS MOVED OFF THE CELL, which is the point of the redesign: the grid is
  // four things and a glance. The basis is owed, so it is owed on the screen
  // the chevron opens.
  assert.match(SCREEN, /reference\.kind === 'target' \? 'Target' : 'Guideline'/);
  assert.match(SCREEN, /is your own target/);
  assert.match(SCREEN, /from \$\{reference\.source\}/);
});

// -- 3. nothing is invented -------------------------------------------------

check('total sugar still gets no comparison at all', () => {
  // UNCHANGED BY THE RESEARCH, and that is why it is still checked: the
  // published limit is for FREE sugars, and this column is all sugar including
  // what is inside whole fruit and the lactose in milk. Colouring the total
  // against a free-sugar limit would mark almost everybody "higher" for eating
  // fruit. Carbohydrate DID gain one - see below.
  assert.equal(S.referenceFor('sugar', HERS), null);
  assert.equal(standing('sugar', { sugar_g: 300 }), null);
});

check('carbohydrate is a wide band, never a floor', () => {
  // Ruth, 24 October: "Surely if there's a % per intake it should be roughly
  // then that's what it should show as a guideline." SACN sets ~50% of total
  // dietary energy, so at 1,800 kcal that is 225g.
  //
  // IT IS A BAND AND DELIBERATELY WIDE. SACN's figure is a population average,
  // and plenty of women eat well below it on purpose. Marking that "Lower"
  // would be the app taking a side in an argument it has no business in.
  const ref = S.referenceFor('carbs', HERS);
  assert.equal(ref.shape.kind, 'band');
  assert.match(ref.stated, /50% of your energy/);
  assert.equal(S.standingFor(225, ref), 'in-range');
  assert.equal(S.standingFor(160, ref), 'in-range', 'a lower-carb day is not a verdict');
  assert.equal(S.standingFor(400, ref), 'higher');
  assert.equal(S.referenceFor('carbs', S.NO_NUTRIENT_PROFILE), null);
});

check('the energy-scaled figures scale, and say what share they are', () => {
  // THE FINDING THE RESEARCH TURNED UP: "70g fat, 20g saturates, 260g carbs"
  // are those percentages already applied to a 2,000 kcal woman who is not her.
  const at = (kcal) => ({ ...HERS, targetKcal: kcal });
  const cases = [
    ['saturated', 0.1, 9],
    ['fat', 0.35, 9],
    ['freeSugar', 0.05, 4],
  ];
  for (const [key, share, perGram] of cases) {
    const ref = S.referenceFor(key, at(1800));
    const expected = Math.round(((1800 * share) / perGram) * 10) / 10;
    assert.equal(ref.shape.value, expected, `${key} is not ${share * 100}% of energy`);
    assert.match(ref.stated, /% of your energy/, `${key} does not say what share it is`);
    assert.ok(S.referenceFor(key, at(2400)).shape.value > ref.shape.value, `${key} does not scale`);
  }
});

check('the flat 20g of saturated fat would have read in range at her energy', () => {
  // The bug the research fixed, as arithmetic. 20g at 1,560 kcal is 11.5% of
  // energy - over the 10% ceiling - while a flat-figure tile said "in range".
  const ref = S.referenceFor('saturated', { ...HERS, targetKcal: 1560 });
  assert.ok(ref.shape.value < 20, `her ceiling is ${ref.shape.value}g, not the flat 20g`);
  assert.equal(S.standingFor(20, ref), 'higher');
});

check('fibre, salt and calcium are absolutes and must not be scaled', () => {
  // Checked at source rather than assumed: all three are set for adults, not as
  // a share of energy. This holds them that way so nobody improves them later.
  assert.equal(S.referenceFor('fibre', { ...HERS, targetKcal: 1200 }).shape.value, 30);
  assert.equal(S.referenceFor('fibre', { ...HERS, targetKcal: 3000 }).shape.value, 30);
  assert.equal(S.referenceFor('salt', { ...HERS, targetKcal: 3000 }).shape.value, 6);
  assert.equal(S.referenceFor('calcium', { ...HERS, targetKcal: 3000 }).shape.value, 700);
  assert.notEqual(S.referenceFor('fibre', S.NO_NUTRIENT_PROFILE), null);
});

check('every figure is cited, with the page and the date it was read', () => {
  assert.ok(C.NUTRIENT_CITATIONS.length >= 8, 'not every figure is cited');
  for (const c of C.NUTRIENT_CITATIONS) {
    assert.ok(c.url.startsWith('https://'), `${c.figure} has no source URL`);
    assert.ok(c.quote.length > 20, `${c.figure} has no quote from the page`);
    assert.match(c.checked, /^\d{4}-\d{2}-\d{2}$/, `${c.figure} has no date`);
    assert.ok(c.body.length > 2, `${c.figure} does not name who set it`);
  }
});

check('and the screen says WHY there is nothing to compare against', () => {
  // Grey with no explanation reads as a figure that failed to load.
  assert.match(SCREEN, /No guideline to compare against/);
  assert.match(SCREEN, /share of your energy rather than a number of grams/);
  assert.match(SCREEN, /published limit is for free sugars/);
});

check('iron waits for an age, and a birthday alone does not drop it', () => {
  // The NHS gives 8.7mg from 50 AND adds that women still menstruating after 50
  // may need 14.8. The first version dropped everybody on their 50th birthday,
  // which is the app deciding somebody's periods have stopped.
  assert.equal(S.referenceFor('iron', { ...HERS, ageYears: null }), null);
  assert.equal(S.referenceFor('iron', { ...HERS, ageYears: 44 }).shape.value, 14.8);
  assert.equal(
    S.referenceFor('iron', { ...HERS, ageYears: 62, stillBleeding: true }).shape.value,
    14.8
  );
  // NOT TOLD IS NOT A NO. Under-stating iron for a woman still losing it
  // monthly is the costlier of the two mistakes.
  assert.equal(
    S.referenceFor('iron', { ...HERS, ageYears: 62, stillBleeding: null }).shape.value,
    14.8
  );
  assert.equal(
    S.referenceFor('iron', { ...HERS, ageYears: 62, stillBleeding: false }).shape.value,
    8.7
  );
});

check('declining to say is not a no', () => {
  // prefer_not_to_say must reach the iron case as null, never false. Read as
  // source: nutrient-profile reaches Supabase and so reaches react-native.
  const PROFILE = read('mobile/src/lib/nutrient-profile.ts');
  assert.match(PROFILE, /export function stillBleedingFrom/);
  const body = PROFILE.slice(PROFILE.indexOf('export function stillBleedingFrom'));
  for (const stage of ['regular', 'irregular', 'perimenopause']) {
    assert.ok(body.includes(`case '${stage}':`), `${stage} is not mapped`);
  }
  for (const stage of ['menopause', 'post_menopause', 'surgical', 'induced']) {
    assert.ok(body.includes(`case '${stage}':`), `${stage} is not mapped`);
  }
  assert.ok(
    !body.includes("case 'prefer_not_to_say':"),
    'declining to answer is being read as an answer'
  );
  assert.match(body, /default:\s*\n\s*return null;/);
});

check('her two targets disappear when she has not set them', () => {
  const blank = S.NO_NUTRIENT_PROFILE;
  assert.equal(S.referenceFor('kcal', blank), null);
  assert.equal(S.referenceFor('protein', blank), null);
  assert.notEqual(S.referenceFor('fibre', blank), null);
});

check('a cell with no reference still appears, in grey', () => {
  // It is included on the strength of a FIGURE, not of a reference.
  assert.match(GRID, /if \(!spec \|\| figure == null\) return null;/);
  assert.match(GRID, /cell\.standing \? STANDING_COLOUR\[cell\.standing\] : theme\.textSecondary/);
});

// -- 4. a mark somebody can see --------------------------------------------

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
function difference(a, b) {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

const CARD_GROUND = (THEME.match(/backgroundElement: '(#[0-9A-Fa-f]{6})'/) ?? [])[1];
const PAGE = (THEME.match(/background: '(#[0-9A-Fa-f]{6})'/) ?? [])[1];

check('the palette was read, so the floors below mean something', () => {
  assert.ok(CARD_GROUND, 'backgroundElement is no longer a plain hex in theme.ts');
  assert.ok(PAGE, 'background is no longer a plain hex in theme.ts');
  assert.equal(S.STANDING_GROUND, PAGE, 'the declared ground is not the one the panel uses');
});

check('the grid is drawn on a LIGHTER panel inside the card', () => {
  // Ruth, 24 October: "If you copy the artwork and have a lighter square inside
  // the Daily average this week square, then you don't have the color problem
  // you invented." She was right, and this is the structural half of the fix -
  // without it the marks go back to 2.02:1 and no colour change rescues them.
  assert.match(CARD, /<ThemedView type="backgroundElement"/, 'the card is no longer sand');
  assert.match(GRID, /<ThemedView type="background" style=\{styles\.panel\}/);
  assert.ok(
    luminance(PAGE) > luminance(CARD_GROUND),
    `the panel (${PAGE}) is not lighter than the card (${CARD_GROUND})`
  );
});

check('every standing colour clears 3 to 1 on the panel it is drawn on', () => {
  for (const [state, colour] of Object.entries(S.STANDING_COLOUR)) {
    const ratio = contrast(colour, S.STANDING_GROUND);
    assert.ok(ratio >= 3, `${state} ${colour} measures ${ratio.toFixed(2)}:1 on the panel`);
  }
});

check('two of her four drawn colours are untouched', () => {
  // The structure did the work, so the pigment barely had to move. In range and
  // Higher are exactly as she chose them; the other two are nudged 8% and 3%,
  // which is the smallest step that clears the floor.
  assert.equal(S.STANDING_COLOUR['in-range'], '#7C8C6A');
  assert.equal(S.STANDING_COLOUR.higher, '#C97458');
});

check('the four colours are four, not three and a near-duplicate', () => {
  const states = Object.keys(S.STANDING_COLOUR);
  assert.equal(new Set(Object.values(S.STANDING_COLOUR)).size, 4);
  for (let i = 0; i < states.length; i += 1) {
    for (let j = i + 1; j < states.length; j += 1) {
      const d = difference(S.STANDING_COLOUR[states[i]], S.STANDING_COLOUR[states[j]]);
      assert.ok(d >= 12, `${states[i]} and ${states[j]} differ by only ${d.toFixed(1)}`);
    }
  }
});

check('one green, which is why she chose this colourway', () => {
  const greens = Object.values(S.STANDING_COLOUR).filter((hex) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return g > r && g > b;
  });
  assert.equal(greens.length, 1, `${greens.length} colours read as green`);
});

// -- 5. the colour can be learned, and heard -------------------------------

check('the grid carries the mark and nothing else', () => {
  // "Icon colour shows how you're doing" - her artwork. The first build had a
  // bar AND a word AND a sentence on every cell, which is what "this is not
  // calm" was describing.
  assert.ok(!/styles\.bar\b/.test(GRID), 'the coloured bar is back on the cell');
  assert.ok(
    !/STANDING_LABEL\[cell\.standing\]/.test(GRID),
    'the state word is back on the cell - it belongs behind the i and on the nutrient screen'
  );
});

check('the four states are named behind the "i", in her artwork\'s words', () => {
  assert.match(CARD, /explaining \? <ColourExplainer onClose=/);
  assert.match(CARD, /setExplaining\(\(v\) => !v\)/);
  assert.deepEqual(S.STANDING_LABEL, {
    'in-range': 'In range',
    'a-little-low': 'A little low',
    lower: 'Lower',
    higher: 'Higher',
  });
  for (const note of Object.values(S.STANDING_NOTE)) {
    assert.ok(note.length > 8, 'a state has no line under it');
  }
  assert.match(S.COLOUR_EXPLAINER.title, /Icon colour shows how you're doing/);
  assert.match(S.COLOUR_EXPLAINER.basis, /your goals, age and sex/);
  // "Why colour, not dots?" is deliberately NOT here. Ruth, 24 October: "that
  // was just for our own understanding to be recorded." It explained why the
  // design is the way it is, which is a note for the people building it.
  assert.ok(
    !('whyTitle' in S.COLOUR_EXPLAINER),
    'the design rationale is back in front of the reader'
  );
});

check('the close sits inside the panel it shuts', () => {
  // Ruth, 24 October: "The cross to shut the colour explainer should be withing
  // it's own box, top right." The card's control opens; the panel's shuts.
  assert.match(CARD, /function ColourExplainer\(\{ onClose \}/);
  assert.match(CARD, /styles\.explainerHead/);
  assert.match(CARD, /<Ionicons name="information-circle-outline"/);
  assert.ok(
    !/name=\{explaining \? 'close-outline' : 'information-circle-outline'\}/.test(CARD),
    'the card control is swapping between opening and shutting again'
  );
});

check('a heading is in the heading face, at every size', () => {
  // Ruth, 24 October: "Any title in the app that's in bold should be in the
  // header font, it looks like coding text in the current font, not editorial
  // at all." The three bold types are smallBold, subtitle and title.
  const TEXT = read('mobile/src/components/themed-text.tsx');
  for (const type of ['smallBold', 'subtitle', 'title']) {
    const at = TEXT.indexOf(`  ${type}: {`);
    assert.ok(at > 0, `${type} is not a style any more`);
    const block = TEXT.slice(at, TEXT.indexOf('},', at));
    assert.match(block, /fontFamily: DisplayFont\.regular/, `${type} is still set in the sans`);
  }
});

check('the table beneath the card says which week it is', () => {
  // Ruth, 24 October: "the title for the table beneath is missing... Changes to
  // Previous Weeks if in past week mode." The stepper moved into the card, so
  // this line is the only thing below it that knows.
  assert.match(VIEW, /isCurrentWeek \? 'This week' : 'Previous weeks'/);
});

check('the explainer is NOT on the screen at rest', () => {
  // The whole reason it is behind an i. A card that renders it unconditionally
  // puts four more sentences on the screen she called not calm.
  assert.match(CARD, /const \[explaining, setExplaining\] = useState\(false\)/);
});

check('a listener is told the state, since colour says nothing aloud', () => {
  assert.match(GRID, /accessibilityLabel=/);
  assert.match(GRID, /STANDING_LABEL_SPOKEN\[cell\.standing\]/);
});

check('the mark is the standing colour, never charcoal', () => {
  // Ruth, 23 October: "I rejected a charcoal text for the icon."
  assert.match(GRID, /color=\{cell\.standing \? STANDING_COLOUR\[cell\.standing\] : theme\.textSecondary\}/);
});

// -- 6. the chevron goes somewhere real ------------------------------------

check('a cell opens that nutrient, not the glossary', () => {
  // Her words, 24 October: "the follow through screens weren't make, just
  // pointed to the generic list of nutrients we already had."
  assert.match(GRID, /pathname: '\/log\/nutrient\/\[key\]'/);
  assert.ok(
    !/router\.push\('\/log\/nutrients'\)/.test(GRID),
    'the grid is back to opening the generic list'
  );
});

check('that screen exists and shows the figure against its range', () => {
  assert.match(SCREEN, /export default function NutrientScreen/);
  assert.match(SCREEN, /per day on average/);
  assert.match(SCREEN, /function Bar\(/);
  assert.match(SCREEN, /Why it matters/);
});

check('sat fat and sugar are nested, not cells of their own', () => {
  // Ruth, 24 October: "nest sat fat and sugar like now."
  assert.match(GRID, /const UNDER: Partial<Record<MacroKey, MacroKey>> = \{\s*saturated: 'fat',\s*sugar: 'carbs',\s*\}/);
  assert.match(GRID, /if \(!tracked\.includes\(key\) \|\| UNDER\[key\]\) continue;/);
  assert.match(GRID, /cell\.child \?/);
});

check('four across, as drawn', () => {
  assert.match(GRID, /const PER_ROW = 4;/);
  assert.match(GRID, /width: `\$\{100 \/ PER_ROW\}%`/);
});

check('the two cells that carry a nested line share a row', () => {
  // Ruth's reorder, 24 October. Fat and carbs are the only cells with a child
  // underneath, so with both in the top row the grid stood a line lopsided.
  // Read as source, not imported: the component reaches react-native.
  const at = GRID.indexOf('const GRID_ORDER: MacroKey[] = [');
  assert.ok(at > 0, 'the grid has gone back to the spine order');
  const order = GRID.slice(at, GRID.indexOf('];', at))
    .match(/'([a-zA-Z]+)'/g)
    .map((s) => s.replace(/'/g, ''));
  assert.deepEqual(order, ['kcal', 'protein', 'fibre', 'salt', 'fat', 'carbs', 'calcium', 'iron']);
  // The two nested parents must land in the same row of four.
  const row = (k) => Math.floor(order.indexOf(k) / 4);
  assert.equal(row('fat'), row('carbs'), 'fat and carbs are in different rows again');
});

check('a nutrient left out of the order is still drawn', () => {
  // The spine drives the parser and the columns; this list is only the layout.
  // One forgotten entry must be late, never missing.
  assert.match(GRID, /\.\.\.MACROS\.map\(\(m\) => m\.key\)\.filter\(\(k\) => !GRID_ORDER\.includes\(k\)\)/);
});

// -- 7. one week, one stepper ---------------------------------------------

check('the week moved into the card and did not multiply', () => {
  // Ruth: "Do it like the artwork... they stay connected though so when the
  // week gets scrolled back the logs underneath go with it, like it does
  // already." Two steppers would each hold their own week.
  assert.match(CARD, /<WeekStepper/);
  assert.match(VIEW, /stepperAbove/);
  assert.match(DAYLOG, /stepperAbove \? null : \(/);
  assert.ok(
    !/<WeekStepper/.test(VIEW),
    'the screen draws its own stepper as well as the card - that is two'
  );
});

check('both read the same weekStart, so they cannot disagree', () => {
  assert.match(VIEW, /weekStart=\{weekStart\}[\s\S]{0,200}onWeekStart=\{setWeekStart\}/);
});

check('holding the forward arrow comes back to this week', () => {
  const STEP = read('mobile/src/components/week-stepper.tsx');
  assert.match(STEP, /onLongPress=\{\(\) => onWeekStart\(currentWeekStart\(\)\)\}/);
  assert.match(STEP, /grow\(1\.6\)/, 'the arrow does not enlarge while held');
  assert.match(STEP, /longPressHint="Back to this week"/);
});

// -- 8. where the bands fall ----------------------------------------------

check('four fifths of a floor is a little low, and below it is lower', () => {
  const fibre = S.referenceFor('fibre', HERS);
  assert.equal(S.standingFor(31, fibre), 'in-range');
  assert.equal(S.standingFor(30, fibre), 'in-range');
  assert.equal(S.standingFor(24, fibre), 'a-little-low');
  assert.equal(S.standingFor(23.9, fibre), 'lower');
});

check('a ceiling has no a-little-high, because just under it is simply under', () => {
  const sat = S.referenceFor('saturated', HERS);
  assert.equal(S.standingFor(19.9, sat), 'in-range');
  assert.equal(S.standingFor(20, sat), 'in-range');
  assert.equal(S.standingFor(20.1, sat), 'higher');
});

check('her protein band turns at both ends', () => {
  const protein = S.referenceFor('protein', HERS);
  assert.equal(S.standingFor(110, protein), 'in-range');
  assert.equal(S.standingFor(125, protein), 'higher');
  assert.equal(S.standingFor(85, protein), 'a-little-low');
  assert.equal(S.standingFor(60, protein), 'lower');
});

check('a typed protein figure is a band of one, not a floor', () => {
  const one = S.referenceFor('protein', { ...HERS, proteinLow: 110, proteinHigh: 110 });
  assert.equal(S.standingFor(110, one), 'in-range');
  assert.equal(S.standingFor(140, one), 'higher');
});

check('nothing logged is no standing, never a zero in range', () => {
  const fibre = S.referenceFor('fibre', HERS);
  assert.equal(S.standingFor(null, fibre), null);
  assert.equal(S.standingFor(undefined, fibre), null);
  assert.equal(S.standingFor(NaN, fibre), null);
  assert.equal(S.standingFor(0, fibre), 'lower');
});

check('age comes off the date of birth and nothing else', () => {
  const now = new Date('2026-10-23T12:00:00Z');
  assert.equal(S.ageFrom('1982-03-01', now), 44);
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
  assert.equal(
    S.standingFor(M.macroAmount('salt', { sodium_mg: 2600 }), {
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

mustFail('total sugar given a number', () =>
  assert.notEqual(S.referenceFor('sugar', HERS), null)
);

mustFail('an energy figure that does not scale', () => {
  const a = S.referenceFor('saturated', { ...HERS, targetKcal: 1500 });
  const b = S.referenceFor('saturated', { ...HERS, targetKcal: 2500 });
  assert.equal(a.shape.value, b.shape.value);
});

mustFail('fibre scaled to energy', () => {
  const a = S.referenceFor('fibre', { ...HERS, targetKcal: 1200 });
  const b = S.referenceFor('fibre', { ...HERS, targetKcal: 3000 });
  assert.notEqual(a.shape.value, b.shape.value);
});

mustFail('a birthday dropping her iron', () =>
  assert.equal(
    S.referenceFor('iron', { ...HERS, ageYears: 62, stillBleeding: null }).shape.value,
    8.7
  )
);

mustFail('iron guessed without an age', () =>
  assert.notEqual(S.referenceFor('iron', { ...HERS, ageYears: null }), null)
);

mustFail('a mark too faint on its panel', () =>
  // The drawn "a little low" on the panel: 2.58, which is why it was nudged.
  assert.ok(contrast('#A89684', S.STANDING_GROUND) >= 3)
);

mustFail('a panel no lighter than the card', () =>
  assert.ok(luminance(CARD_GROUND) > luminance(PAGE))
);

mustFail('two colours that read as one', () =>
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

mustFail('the word back on the cell', () =>
  assert.ok(!/STANDING_LABEL\[cell\.standing\]/.test('{STANDING_LABEL[cell.standing]}'))
);

mustFail('the bar back on the cell', () =>
  assert.ok(!/styles\.bar\b/.test('<View style={[styles.bar, { backgroundColor }]} />'))
);

mustFail('the chevron back to the glossary', () =>
  assert.ok(!/router\.push\('\/log\/nutrients'\)/.test("onPress={() => router.push('/log/nutrients')}"))
);

mustFail('the explainer rendered at rest', () =>
  assert.match('const [explaining, setExplaining] = useState(true);', /useState\(false\)/)
);

mustFail('a second stepper on the screen', () =>
  assert.ok(!/<WeekStepper/.test('      <WeekStepper weekStart={weekStart} />'))
);

console.log('');
for (const name of useless) console.log(`  USELESS  ${name} passed on broken input`);
console.log(`\n  ${passed} passed, ${failed.length} failed, ${useless.length} useless\n`);
if (failed.length > 0 || useless.length > 0) process.exit(1);
