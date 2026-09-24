// WHAT I TRACK (Ruth, 24 September 2026). Calories and protein always on and
// not toggleable; fat, saturated fat, carbohydrates, sugar, fibre and salt off
// by default; whatever is on shows on every food row and in the daily totals.
//
//   npx tsx scripts/probe-tracked-macros.mjs

import {
  averageLine,
  MACROS,
  OPTIONAL,
  isAlwaysOn,
  trackedMacros,
  toStored,
  macroLine,
  totalLine,
} from '../mobile/src/lib/tracked-macros.ts';

let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}`);
    if (detail !== undefined) console.log(`        ${detail}`);
  }
}

console.log('\n  WHAT I TRACK\n');

// ---- the two that are not hers to switch off ------------------------------
{
  check('calories and protein are always on', isAlwaysOn('kcal') && isAlwaysOn('protein'));
  check('fat is not', !isAlwaysOn('fat'));
  check('six are offered', OPTIONAL.length === 6, String(OPTIONAL.length));
  check('and none of the six is calories or protein', !OPTIONAL.some((m) => isAlwaysOn(m.key)));

  check('nothing stored still means both', JSON.stringify(trackedMacros(null)) === '["kcal","protein"]', JSON.stringify(trackedMacros(null)));
  check('an empty list still means both', JSON.stringify(trackedMacros([])) === '["kcal","protein"]');
  check('they cannot be switched off by storing a list without them',
    trackedMacros(['fat']).includes('kcal') && trackedMacros(['fat']).includes('protein'),
    JSON.stringify(trackedMacros(['fat'])));
  check('and storing never records them', JSON.stringify(toStored(['kcal', 'protein', 'fat'])) === '["fat"]', JSON.stringify(toStored(['kcal', 'protein', 'fat'])));
}

// ---- rubbish out of the database does not reach a screen ------------------
{
  check('an unknown key is dropped', !trackedMacros(['fat', 'vitamins']).includes('vitamins'));
  check('a string instead of a list is survived', JSON.stringify(trackedMacros('fat')) === '["kcal","protein"]');
  check('nulls inside the list are survived', JSON.stringify(trackedMacros([null, 'sugar'])) === '["kcal","protein","sugar"]', JSON.stringify(trackedMacros([null, 'sugar'])));
  check('order is always MACROS order, not storage order',
    JSON.stringify(trackedMacros(['salt', 'fat'])) === '["kcal","protein","fat","salt"]',
    JSON.stringify(trackedMacros(['salt', 'fat'])));
}

// ---- her row --------------------------------------------------------------
{
  const row = { kcal: 445, protein_g: 34, fat_g: 28, carbs_g: 9, sodium_mg: 420, sugar_g: 4.2 };
  check('the default row is exactly what she drew',
    macroLine(row, trackedMacros(null)) === '445 kcal · 34g protein',
    macroLine(row, trackedMacros(null)));

  const withFat = macroLine(row, trackedMacros(['fat']));
  check('switching fat on adds it, in order', withFat === '445 kcal · 34g protein · 28g fat', withFat);

  const withSalt = macroLine(row, trackedMacros(['salt']));
  check('salt reads in grams, not milligrams of sodium', withSalt.endsWith('1.1g salt'), withSalt);

  const small = macroLine({ kcal: 100, protein_g: 2.4, sugar_g: 4.25 }, trackedMacros(['sugar']));
  check('a figure under ten grams keeps one decimal', small === '100 kcal · 2.4g protein · 4.3g sugar', small);

  const big = macroLine({ kcal: 1455, protein_g: 95 }, trackedMacros(null));
  check('a thousand gets its comma', big === '1,455 kcal · 95g protein', big);
}

// ---- a missing figure is not a zero ---------------------------------------
{
  const row = { kcal: 445, protein_g: 34 };
  const line = macroLine(row, trackedMacros(['fibre']));
  check('fibre nobody worked out is left out, not shown as 0g', line === '445 kcal · 34g protein', line);
}

// ---- the day and the week -------------------------------------------------
{
  const rows = [
    { kcal: 445, protein_g: 34 },
    { kcal: 780, protein_g: 48 },
    { kcal: 230, protein_g: 13 },
  ];
  check("today's total adds up", totalLine(rows, trackedMacros(null)) === '1,455 kcal · 95g protein', totalLine(rows, trackedMacros(null)));
  check('a day with nothing in it says nothing', totalLine([], trackedMacros(null)) === '');
  check('a row missing a figure does not drag the total to zero',
    totalLine([{ kcal: 100, protein_g: 10 }, { kcal: 50 }], trackedMacros(null)) === '150 kcal · 10g protein',
    totalLine([{ kcal: 100, protein_g: 10 }, { kcal: 50 }], trackedMacros(null)));
}

// ---- every macro has somewhere to come from -------------------------------
{
  check('each macro names a column', MACROS.every((m) => typeof m.column === 'string' && m.column.length > 0));
  check('no two macros share a key', new Set(MACROS.map((m) => m.key)).size === MACROS.length);
}

// ---- the week line, which is an average over days logged -----------------
{
  const week = [
    [{ kcal: 1000, protein_g: 50 }, { kcal: 455, protein_g: 45 }], // 1455 / 95
    [], // not logged
    [{ kcal: 971, protein_g: 31 }], // 971 / 31
    [],
    [],
    [],
    [],
  ];
  const { line, daysLogged } = averageLine(week, trackedMacros(null));
  check('averaged over days logged, not over seven', line === '1,213 kcal · 63g protein', line);
  check('and it says how many days that was', daysLogged === 2, String(daysLogged));

  const none = averageLine([[], [], []], trackedMacros(null));
  check('a week with nothing in it says nothing', none.line === '' && none.daysLogged === 0, JSON.stringify(none));
}

// ---- a macro worked out on some days only ---------------------------------
{
  const week = [
    [{ kcal: 500, protein_g: 20, fibre_g: 6 }],
    [{ kcal: 500, protein_g: 20 }],
  ];
  const { line } = averageLine(week, trackedMacros(['fibre']));
  check(
    'fibre averages over the days it was known, not over both',
    line === '500 kcal · 20g protein · 6g fibre',
    line
  );
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
