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
const B = await import(root + '/mobile/src/lib/nutrient-breakdown.ts');

const read = (p) => readFileSync(p, 'utf8').replace(/\r/g, '');

/**
 * The same file with its comments taken out.
 *
 * WRITTEN AFTER THIS CHECK FAILED ON ITS OWN PROSE. Three assertions below scan
 * for words that must never reach a reader - "incomplete" as a label, "try" as
 * an instruction - and all three fired on comments explaining why those words
 * are banned. A check that reads the explanation of a rule as a breach of it is
 * testing the source text, not the behaviour.
 */
const withoutComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
const GRID = read('mobile/src/components/nutrient-grid.tsx');
const CARD = read('mobile/src/components/week-average-card.tsx');
const SCREEN = read('mobile/src/app/(tabs)/log/nutrient/[key].tsx');
const VIEW = read('mobile/src/components/food-log-view.tsx');
const DAYLOG = read('mobile/src/components/day-log.tsx');
const THEME = read('mobile/src/constants/theme.ts');
// THE SPEC IS READ BY THE RUNNER, not only by people. A decision recorded
// somewhere nothing imports is one whose errors nobody is forced to find - and
// these particular decisions were lost to a context summary once already,
// costing most of a working day to re-derive badly.
const SPEC = read('mobile/SELODIA_SPEC.md');

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
  assert.match(SCREEN, /reference\.kind === 'target' \? 'Your target' : 'Guideline'/);
  // The figure itself moved under the bar, beside the span it describes.
  assert.match(SCREEN, /\{reference\.stated\}/);
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

// -- 9. where yours came from, and what is not in it -----------------------
//
// The notes she agreed on 23 October and had to ask for twice: list the foods
// by default, group only where the group says something the names do not, hide
// zero rows, and suggest from a real table rather than from imagination.

const LOG = [
  { name: 'Porridge', fibre_g: 4, protein_g: 5, protein_source: 'plant', sodium_mg: 40 },
  { name: 'Chicken breast', fibre_g: 0, protein_g: 30, protein_source: 'animal', sodium_mg: 80 },
  { name: 'Greek yoghurt', fibre_g: null, protein_g: 10, protein_source: 'animal', sodium_mg: 50 },
  { name: 'Lentils', fibre_g: 6, protein_g: 9, protein_source: 'plant', sodium_mg: 10 },
  { name: 'Collagen powder', fibre_g: 0, protein_g: 10, protein_source: 'collagen', sodium_mg: 0 },
  { name: 'Mystery stew', fibre_g: 2, protein_g: 7, protein_source: null, sodium_mg: 400 },
];

check('a food that carried none of it is not listed', () => {
  // "A vegan seeing Meat, poultry & fish 0g" was her example; it is noise for
  // everybody. Chicken and collagen carry no fibre, and nor does a null.
  const rows = B.whereItCameFrom(LOG, 'fibre');
  const names = rows.map((r) => r.label);
  assert.ok(!names.includes('Chicken breast'), 'a zero row is being listed');
  assert.ok(!names.includes('Greek yoghurt'), 'a null row is being listed');
  assert.deepEqual(names, ['Lentils', 'Porridge', 'Mystery stew']);
});

check('the shares add up to the whole', () => {
  // A breakdown whose parts do not sum is one somebody will try to reconcile
  // and fail, which is worse than no breakdown.
  const rows = B.whereItCameFrom(LOG, 'fibre');
  const total = rows.reduce((n, r) => n + r.share, 0);
  assert.ok(Math.abs(total - 1) < 0.0001, `shares sum to ${total}`);
});

check('the tail is folded in, never truncated', () => {
  const many = Array.from({ length: 10 }, (_, i) => ({
    name: `Food ${i}`,
    fibre_g: 10 - i,
  }));
  const rows = B.whereItCameFrom(many, 'fibre', 4);
  assert.equal(rows.length, 4);
  assert.match(rows[3].label, /^Other \(7\)$/);
  const total = rows.reduce((n, r) => n + r.share, 0);
  assert.ok(Math.abs(total - 1) < 0.0001, 'folding the tail lost some of the total');
});

check('the breakdown is in the same unit as the figure above it', () => {
  // Salt is stored as sodium in milligrams. A breakdown in milligrams under a
  // figure in grams of salt is a breakdown of something else - the same unit
  // fault that let a 6 g salt day read "in range".
  const rows = B.whereItCameFrom(LOG, 'salt');
  const stew = rows.find((r) => r.label === 'Mystery stew');
  assert.ok(stew.amount > 0.9 && stew.amount < 1.1, `400 mg sodium came through as ${stew.amount}`);
});

check('no food is labelled incomplete, or graded at all', () => {
  // THE ROWS THEMSELVES, which are now her own food names. Labelling anything
  // "incomplete" is a judgement about a food, which her 21 October rule
  // forbids - and the useful truth is not "this one is lesser" but "these
  // complete each other", which is a sentence rather than a label.
  const rows = B.whereItCameFrom(LOG, 'protein');
  for (const row of rows) {
    for (const word of ['incomplete', 'poor', 'bad', 'low quality', 'worse']) {
      assert.ok(
        !row.label.toLowerCase().includes(word),
        `"${row.label}" grades a food - that is a verdict, not a name`
      );
    }
  }
});

check('protein lists her foods too, with no categories anywhere', () => {
  // Ruth, 24 October: "this is categories, not what itens the user ate." The
  // one exception the original note allowed has been removed - see the spec.
  const rows = B.whereItCameFrom(LOG, 'protein');
  const names = rows.map((r) => r.label);
  assert.ok(names.includes('Chicken breast'), 'protein is not listing her foods');
  assert.ok(names.includes('Lentils'));
  for (const category of ['Meat', 'Dairy', 'Beans, nuts', 'Animal', 'Plant', 'Not classified']) {
    assert.ok(!names.includes(category), `"${category}" is a category, not a food she ate`);
  }
  // And the grouping is gone from the code entirely, not merely unused.
  const src = read('mobile/src/lib/nutrient-breakdown.ts');
  assert.ok(!/proteinBySource/.test(src), 'the grouping is still here');
  assert.ok(!/PROTEIN_SOURCE_LABEL/.test(src), 'the category labels are still here');
  assert.ok(!/proteinBySource/.test(SCREEN), 'the screen still reaches for the grouping');
});

check('nothing maps food names to categories', () => {
  // Ruth, 23 October: group "on something the parser already produces, rather
  // than a food-to-category table somebody has to maintain forever." A list of
  // food words in this file is that table arriving by the back door.
  const src = withoutComments(read('mobile/src/lib/nutrient-breakdown.ts'));
  for (const food of ['cheese', 'yoghurt', 'chicken', 'salmon', 'lentil', 'oats']) {
    assert.ok(
      !new RegExp(food, 'i').test(src),
      `"${food}" is named in the grouping code - that is a lookup table`
    );
  }
  // And there is no grouping left. The column may still appear in the row
  // TYPE - it is a real column on food_items - but nothing may group by it.
  assert.ok(!/proteinBySource|PROTEIN_SOURCE_LABEL/.test(src), 'the grouping is back');
  assert.ok(!/byGroup/.test(src), 'something is grouping rows again');
});

check('a suggestion is a food she is NOT already eating', () => {
  const candidates = [
    { name: 'Lentils', per100g: 8 },
    { name: 'Chia seeds', per100g: 34 },
    { name: 'Porridge oats', per100g: 9 },
  ];
  const eaten = LOG.map((r) => r.name);
  const out = B.suggestionsFor(candidates, eaten, 'fibre', []);
  const names = out.map((s) => s.food);
  assert.ok(!names.includes('Lentils'), 'suggesting a food already in her log');
  assert.ok(names.includes('Chia seeds'));
});

check('a suggestion says what a food carries, never what to do', () => {
  // Her rule, 21 October, and in the spec: "A handful of berries carries about
  // 2g of fibre" rather than "try adding berries".
  const out = B.suggestionsFor([{ name: 'Chia seeds', per100g: 34 }], [], 'fibre', []);
  assert.match(out[0].carries, /carries about/);
  // Scanned with the comments stripped: the prose explaining why instructions
  // are banned is not itself an instruction.
  const src = withoutComments(read('mobile/src/lib/nutrient-breakdown.ts')).toLowerCase();
  for (const word of ['try ', 'you should', 'make sure', 'aim for', 'add more']) {
    assert.ok(!src.includes(word), `"${word}" is an instruction`);
  }
});

check('nothing she reacts to is ever suggested', () => {
  // "never anything the allergy gate catches" - the third clause of the rule,
  // and the only one with a consequence. The match is loose on purpose: "nuts"
  // has to catch "Walnuts", because over-matching costs a suggestion and
  // under-matching costs something that matters.
  const out = B.suggestionsFor(
    [
      { name: 'Walnuts', per100g: 7 },
      { name: 'Chia seeds', per100g: 34 },
    ],
    [],
    'fibre',
    ['nuts']
  );
  assert.deepEqual(out.map((x) => x.food), ['Chia seeds']);
});

check('the gate cannot be forgotten at a call site', () => {
  // No default argument: a gate with one is a gate somebody omits, and the
  // failure is silent and in the wrong direction.
  const src = read('mobile/src/lib/nutrient-breakdown.ts');
  assert.ok(!/avoid: string\[\] = \[\]/.test(src), 'avoid has a default again');
  assert.match(SCREEN, /from\('allergies'\)/);
  assert.match(SCREEN, /spec\.key,\s*\n\s*avoid\s*\n/);
});

check('nothing is suggested where more is not the point', () => {
  // Ruth, 24 October: "What on earth is this????" - the Carbohydrates screen
  // was offering white sugar, icing sugar and demerara sugar, because the
  // candidates were ranked by concentration and the densest carbohydrate foods
  // in a composition table are sugars.
  //
  // THE RANKING WAS NOT THE BUG. Nothing asked whether suggesting MORE of this
  // nutrient made sense at all. For a ceiling it is incoherent; for a band it
  // is presumptuous; for energy it is absurd.
  const floors = [];
  const others = [];
  for (const m of M.MACROS) {
    const ref = S.referenceFor(m.key, HERS);
    if (!ref) continue;
    (ref.shape.kind === 'floor' ? floors : others).push(m.key);
  }
  // The four where more is genuinely the point, and nothing else.
  assert.deepEqual(floors.sort(), ['calcium', 'fibre', 'iron'].sort());
  for (const key of others) {
    assert.notEqual(
      S.referenceFor(key, HERS).shape.kind,
      'floor',
      `${key} would be offered more food`
    );
  }
  // And the screen gates on exactly that, plus being under it.
  assert.match(SCREEN, /ref\?\.shape\.kind === 'floor' && amountNow != null && amountNow < ref\.shape\.value/);
  assert.match(SCREEN, /if \(spec && worthSuggesting\)/);
});

check('a nutrient she is already hitting gets no suggestions', () => {
  // A section headed "Suggestions for you" above a figure she is meeting is
  // the app inventing a problem. This is a food app used by women who have
  // been told what to eat all their lives.
  const fibre = S.referenceFor('fibre', HERS);
  assert.equal(S.standingFor(35, fibre), 'in-range');
  assert.ok(35 > fibre.shape.value, 'the gate would still fire on a day she met it');
});

check('a figure with no amount is never invented', () => {
  assert.deepEqual(B.suggestionsFor([{ name: 'Water', per100g: 0 }], [], 'fibre', []), []);
  assert.deepEqual(B.whereItCameFrom([], 'fibre'), []);
  assert.deepEqual(B.whereItCameFrom([], 'protein'), []);
});

// -- 10. the child inside the parent's bar --------------------------------

check('saturated fat is drawn inside the fat bar, on the same scale', () => {
  // Ruth, 24 October: "within it with it's own target along the fat line,
  // which actualy then shows it as part of the fat, which is truer."
  assert.match(SCREEN, /const CHILD_OF: Partial<Record<MacroKey, MacroKey>> = \{\s*fat: 'saturated',\s*carbs: 'sugar',\s*\}/);
  assert.match(SCREEN, /styles\.childFill/);
  // Inside, sharing the parent's left edge - not a second bar beneath, which
  // would invite adding the two together. A thin underline, so the part reads
  // as subordinate to the whole rather than as the measurement itself.
  assert.match(SCREEN, /childFill: \{ position: 'absolute', left: 0, bottom: 0, height: 4 \}/);
});

check('the bar names its own span rather than drawing bare lines', () => {
  // Ruth, 24 October: "This diagram makes no sense." It drew one or two
  // unlabelled vertical rules on a plain track, so the reader had to be told
  // what the lines meant - a bar whose job is to be understood before it is
  // read had become something needing a key.
  //
  // A floor, a ceiling and a band are three shapes of "all right", and each is
  // now drawn as the span it actually is, with the figure written beneath.
  assert.match(SCREEN, /const zone =/);
  assert.match(SCREEN, /s\.kind === 'floor'/);
  assert.match(SCREEN, /s\.kind === 'ceiling'/);
  assert.match(SCREEN, /styles\.zone/);
  assert.ok(!/styles\.mark\b/.test(SCREEN), 'the bare marker lines are back');
});

check('the generic food list was replaced, not kept alongside', () => {
  // Ruth: "Suggestions for you replace where it comes from, since that's in
  // the food log built above." A generic list of foods carrying a nutrient is
  // a worse version of the section listing the ones she actually ate.
  assert.match(SCREEN, /Where yours came from/);
  assert.match(SCREEN, /Suggestions for you/);
  assert.ok(
    !/Where it comes from/.test(withoutComments(SCREEN)),
    'the generic list is still on the screen beside the real one'
  );
  // And the generic prose field is genuinely unused now, not merely unrendered.
  assert.ok(
    !/explainer\.where/.test(withoutComments(SCREEN)),
    'the screen still reads the generic food list'
  );
});

check('how to have them comes from a sourced pairing', () => {
  // "and how to have them (ie, if they need pairing or eaten alongside
  // something else to be absorbed)". These already existed, each checked
  // against a named source.
  assert.match(SCREEN, /nutrientPairFor\(/);
  assert.match(SCREEN, /\{pair\.why\}/);
});

// -- 11. the scope is written down, not remembered ------------------------

check('the scoped decisions are in the spec, not only in a chat', () => {
  // Ruth, 24 October: "this was ALL scoped yesterday and now we are doing it
  // all over again." The cause was mechanical - the conversation was
  // auto-summarised, the summary kept the open question and dropped the
  // decision behind it, and nothing in the repository held it.
  const at = SPEC.indexOf('SCOPED DECISIONS: THE FOOD LOG');
  assert.ok(at > 0, 'the scope has gone from the spec');
  const section = SPEC.slice(at, at + 6000);
  for (const line of [
    'List the foods',
    'food-to-category table',
    'no exception for protein',
    'Hide',
    'no vegan, vegetarian or flexitarian flag',
    'Never anything the allergy gate catches',
    'carries',
    'Icon colour shows how you',
  ]) {
    assert.ok(section.includes(line), `the spec no longer records: ${line}`);
  }
});

check('the spec records that there are no categories', () => {
  const at = SPEC.indexOf('SCOPED DECISIONS: THE FOOD LOG');
  const section = SPEC.slice(at, at + 6000).replace(/\s+/g, ' ');
  assert.ok(section.includes('There is no exception for protein'));
  assert.ok(section.includes('Every nutrient, no exceptions'));
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

mustFail('a zero row listed', () => {
  const rows = B.whereItCameFrom(LOG, 'fibre');
  assert.ok(rows.map((r) => r.label).includes('Chicken breast'));
});

mustFail('shares that do not sum', () => {
  const rows = B.whereItCameFrom(LOG, 'fibre');
  const total = rows.reduce((n, r) => n + r.share, 0);
  assert.ok(Math.abs(total - 1) > 0.0001);
});

mustFail('salt broken down in milligrams', () => {
  const stew = B.whereItCameFrom(LOG, 'salt').find((r) => r.label === 'Mystery stew');
  assert.ok(stew.amount > 100);
});

mustFail('unclassified protein folded into a group', () => {
  const labels = B.proteinBySource(LOG).map((r) => r.label);
  assert.ok(!labels.includes('Not classified'));
});

mustFail('suggesting a food she already eats', () => {
  const out = B.suggestionsFor([{ name: 'Lentils', per100g: 8 }], ['Lentils'], 'fibre', []);
  assert.equal(out.length, 1);
});

mustFail('suggesting something she reacts to', () => {
  const out = B.suggestionsFor([{ name: 'Walnuts', per100g: 7 }], [], 'fibre', ['nuts']);
  assert.equal(out.length, 1);
});

mustFail('the generic food list kept alongside', () =>
  assert.ok(!/Where it comes from/.test(withoutComments('<ThemedText>Where it comes from</ThemedText>')))
);

mustFail('a graded group label', () =>
  assert.ok(!'Plant sources (incomplete)'.toLowerCase().includes('incomplete'))
);

mustFail('the scope quietly dropped from the spec', () =>
  assert.ok(''.includes('SCOPED DECISIONS: THE FOOD LOG'))
);

mustFail('a grouping creeping back in', () => {
  // Held as a check rather than as a memory, because memory lost it twice.
  const src = read('mobile/src/lib/nutrient-breakdown.ts');
  assert.match(src, /proteinBySource/);
});

mustFail('sugar offered as a carbohydrate suggestion', () => {
  // The shipped bug, as arithmetic: carbohydrate is a band, so the gate must
  // refuse it however good the candidates look.
  const ref = S.referenceFor('carbs', HERS);
  assert.equal(ref.shape.kind, 'floor');
});

mustFail('a category shown as a food she ate', () => {
  const names = B.whereItCameFrom(LOG, 'protein').map((r) => r.label);
  assert.ok(names.includes('Meat, fish, dairy & eggs'));
});

mustFail('comments mistaken for code', () =>
  // The fault this helper exists to stop: the explanation of a banned word read
  // as a use of it.
  assert.ok(!withoutComments('// never say try here\nconst a = 1;').includes('const'))
);

console.log('');
for (const name of useless) console.log(`  USELESS  ${name} passed on broken input`);
console.log(`\n  ${passed} passed, ${failed.length} failed, ${useless.length} useless\n`);
if (failed.length > 0 || useless.length > 0) process.exit(1);
