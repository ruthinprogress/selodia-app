// DOES ANYTHING ACTUALLY READ WHAT SHE SWITCHED ON?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-tracked-macros-reach-chat.mjs
//
// Ruth asked "What about saturated fat in the past week?" and was told: "That's
// not something your record tracks - I've got calories and protein logged, but
// no breakdown of fat types. If it matters to you, your GP or a food diary with
// that detail would be the place to look."
//
// Every word of it was wrong. Every meal she had logged since 27 September
// carried a saturated_fat_g - 38g on the Sunday pizza, 29.6g on the four-egg
// omelette - and she had switched all six optional macros on in "What I track",
// stored in user_profile.tracked_macros since 24 September.
//
// THE PARSE CAPTURED IT. THE COLUMN HELD IT. THE SETTING RECORDED THAT SHE
// WANTED IT. And nothing on the server read either one: the food handed to the
// model was built as `raw_text + ' (' + kcal + 'kcal, ' + protein_g + 'g
// protein)'`, so six figures sat on the row and never reached the page.
//
// COLLECTED, STORED, AND READ BY NOBODY - the third instance found on 4 October
// alone, after the duplicate guard that could not see a backdated meal and the
// named day that had nowhere to go. This one is the worst of the three because
// it did not merely fail to answer: it asserted an absence, and she acted on it
// by going to switch on a setting that was already on.
//
// So this check is about the WIRE, not the arithmetic. The function can be
// perfect and the bug returns the moment nothing calls it.

import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { trackedMacroKeys, buildTrackedMacroBlock } = await import(
  root + '/app/lib/tracked-macro-summary.ts'
);

let pass = 0;
const failures = [];
// AWAITED. The first version did not, so an async case's assertions ran after
// the tally was printed and the case could never fail - the one thing a check
// must be able to do.
async function check(name, fn) {
  try {
    const note = await fn();
    console.log(`  PASS  ${name}${note ? `   ${note}` : ''}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL  ${name}\n          ${e.message}`);
    failures.push(name);
  }
}

const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

console.log('\n  WHAT SHE SWITCHED ON REACHES THE MODEL\n');

await check('the setting is read at all', () => {
  assert.ok(
    /tracked_macros/.test(route),
    'ask-selodia never mentions tracked_macros, so what she switched on in ' +
      '"What I track" is stored and read by nobody - exactly as it was when she ' +
      'was told her record does not keep saturated fat'
  );
  assert.ok(
    /buildTrackedMacroBlock\(/.test(route),
    'nothing builds the block, so the figures stay on the row and off the page'
  );
  return 'read, and turned into something';
});

await check('the block reaches the prompt, not just a variable', () => {
  // THE FAILURE MODE THIS GUARDS. A block that is built and never interpolated
  // is indistinguishable, from the model's side, from one that was never built -
  // and it looks entirely correct in a code review.
  assert.ok(
    /\$\{trackedMacroBlock\}/.test(route),
    'trackedMacroBlock is built and never interpolated into the prompt'
  );
  return 'interpolated beside the day state';
});

await check('only the macros she actually switched on', () => {
  assert.deepStrictEqual(trackedMacroKeys(null), []);
  assert.deepStrictEqual(trackedMacroKeys(['saturated', 'fibre']), ['saturated', 'fibre']);
  // Calories and protein are never toggles and must not appear as ones.
  assert.deepStrictEqual(trackedMacroKeys(['kcal', 'protein', 'sugar']), ['sugar']);
  assert.deepStrictEqual(trackedMacroKeys(['nonsense', 42, null, 'salt']), ['salt']);
  return 'unknown keys dropped, kcal and protein never toggles';
});

const ROWS = [
  { happened_at: '2026-10-03T12:00:00Z', saturated_fat_g: 12, fat_g: 30, sugar_g: 9 },
  { happened_at: '2026-10-02T12:00:00Z', saturated_fat_g: 8, fat_g: 22, sugar_g: 5 },
];
const stubWith = (rows) => ({
  from: () => ({
    select: () => ({
      eq: () => ({ gte: () => ({ order: () => ({ limit: async () => ({ data: rows, error: null }) }) }) }),
    }),
  }),
});

await check('a macro she has NOT switched on is offered, never denied', async () => {
  // HER CORRECTION, AND IT IS THE WHOLE POINT: "I switched them on after the
  // chat said it wasn't seeing them, but she should have told me they were
  // available and suggested i turn them on."
  //
  // The toggle has never gated capture - tracked_macros appears nowhere in the
  // parse or in food-logging - so "that's not something your record tracks" was
  // false with the switch off exactly as it was with it on.
  const out = await buildTrackedMacroBlock(stubWith(ROWS), 'u', []);
  assert.ok(out.length > 0, 'nothing is said at all when she tracks nothing, so the ' +
    'model is left to guess - and last time it guessed that her record does not keep it');
  assert.ok(/ALSO RECORDED, BUT NOT SWITCHED ON/.test(out), 'it does not say the figures exist');
  assert.ok(/saturated fat/.test(out), 'saturated fat is not named as available');
  assert.ok(/What I track/.test(out), 'it does not say where she can switch it on');
  assert.ok(/offer to switch it on/.test(out), 'it does not tell the model to OFFER');
  return 'named, with the switch offered';
});

await check('an untracked macro is named, not totalled', async () => {
  // Answering with the numbers anyway would override a setting she is entitled
  // to have meant. The offer is the respectful shape; it costs her one tap.
  const out = await buildTrackedMacroBlock(stubWith(ROWS), 'u', []);
  assert.ok(!/12g saturated fat/.test(out), 'it quotes figures she has not asked to see');
  assert.ok(!/2026-10-03:/.test(out), 'it prints daily totals for switched-off macros');
  return 'the offer, not the nutrition label';
});

await check('a macro with no figures is not offered', async () => {
  // Offering something the parse never managed to estimate would be the same
  // false promise one step along.
  const out = await buildTrackedMacroBlock(
    stubWith([{ happened_at: '2026-10-03T12:00:00Z', saturated_fat_g: 12 }]),
    'u',
    []
  );
  assert.ok(/saturated fat/.test(out), 'the one it does have is missing');
  assert.ok(!/fibre/.test(out), 'fibre was offered with no figures behind it');
  return 'only what is actually there';
});

await check('no food at all says nothing rather than nothing-is-tracked', async () => {
  const out = await buildTrackedMacroBlock(stubWith([]), 'u', ['saturated']);
  assert.strictEqual(out, '', 'a claim was made with no rows to back it');
  return 'silence, not a claim';
});

await check('a switched-on macro arrives with its figures and its caveat', async () => {
  // READ THE OUTPUT, NOT THE SOURCE. An earlier version matched the module's own
  // text and failed on its own line wrapping - the sentences are built by
  // template concatenation, so the words are not adjacent in the file. A check
  // that reads a spelling reports on formatting. Same lesson as the
  // comment-stripping in check-ask-about-this.mjs, one layer along.
  const out = await buildTrackedMacroBlock(stubWith(ROWS), 'u', ['saturated']);
  assert.ok(/12g saturated fat/.test(out), 'the figures are missing');
  assert.ok(/2026-10-03:/.test(out), 'the days are not broken out, so a week cannot be summed');
  // THE BLOCK ADDRESSES HER DIRECTLY SINCE 5 OCTOBER. These two assertions were
  // pinned to its third-person wording, which is the wording that cost her the
  // answer: see check-second-person.mjs. The claim is the same; only the person
  // speaking changed.
  assert.ok(/I HAVE the figures/.test(out), 'the model is not told it can answer from them');
  assert.ok(
    /as complete as your logging/.test(out),
    'nothing says the totals are only as good as what she logged, which is the one ' +
      'honest caveat on a figure summed from her own entries'
  );
  assert.ok(
    /do not use it to avoid answering/.test(out),
    'the caveat has no limit on it, so it becomes a reason to dodge the question'
  );
  return 'figures, days, and one honest caveat';
});

// ───────────────────────────────────────────────────────────────────────────
// AND THE LOG MUST NOT CONTRADICT THE BLOCK (6 October 2026).
//
// THE CASE THAT WOULD HAVE CAUGHT WHAT THREE SITTINGS MISSED. Every case above
// passed throughout, because they all test the block, and the block was right. A
// probe against her real account produced 1,610 characters of her own saturated
// fat, day by day. What was wrong was the thirty or forty lines ABOVE it: one per
// meal, each rendered "(980kcal, 34g protein)", every one of them evidence that
// the log holds two macros. The model believed the log over the block, which is
// the correct instinct, and told her twice that her saturated fat is not
// recorded.
//
// So the property is not "is the block good". It is "can the log and the block
// disagree", and the answer has to be no.

await check('the meal lines carry the macros, so they cannot contradict the block', async () => {
  const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8');
  const code = route.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const at = code.indexOf('const foodSummary');
  assert.ok(at > 0, 'the food summary is gone');
  const block = code.slice(at, at + 900);

  assert.ok(
    /mealMacros/.test(block),
    'a meal line shows kcal and protein only, which is what outvoted the macro block'
  );
  assert.ok(
    /trackedMacroKeys/.test(code),
    'the meal lines do not read what she has switched on, so they show everything or nothing'
  );
  return 'the log says what the block says';
});

await check('turn_context sends the columns the meal lines need', async () => {
  // THE OTHER HALF, AND THE HALF THAT IS EASY TO FORGET. Rendering a column the
  // RPC does not select is "two lists nothing compares" again: nothing throws,
  // the figure is simply absent, and the line quietly goes back to two macros.
  // THE NEWEST MIGRATION THAT TOUCHES recentFood, as a whole file.
  //
  // The first version of this sliced 500 characters after the LAST occurrence of
  // 'recentFood' across every migration concatenated. That occurrence is the
  // $anchor$ string inside this very migration - the text it searches FOR, not
  // the text it writes - so the case failed on its own search term. Reading the
  // whole file avoids guessing which occurrence is the definition.
  const files = readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const touching = files.filter((f) =>
    readFileSync(`supabase/migrations/${f}`, 'utf8').includes("'recentFood'")
  );
  assert.ok(touching.length > 0, 'no migration selects recentFood at all');
  const newest = readFileSync(`supabase/migrations/${touching[touching.length - 1]}`, 'utf8');
  for (const column of ['saturated_fat_g', 'fat_g', 'carbs_g', 'sugar_g', 'fibre_g', 'sodium_mg']) {
    assert.ok(
      newest.includes(column),
      `the newest recentFood definition does not select ${column}, so a meal line can never show it`
    );
  }
  return `six columns, in ${touching[touching.length - 1]}`;
});

await check('and these two can fail', async () => {
  // The shipped line, which is the one that cost three sittings.
  const shipped =
    "const foodSummary = recentFood.map((f) => f.raw_text + ' (' + f.kcal + 'kcal, ' + f.protein_g + 'g protein)')";
  assert.ok(!/mealMacros/.test(shipped), 'the fixture is not the old line');
  const narrow = "'recentFood', select happened_at, raw_text, kcal, protein_g from food_logs";
  assert.ok(!narrow.includes('saturated_fat_g'), 'the fixture still selects the macros');
  return 'the old meal line and the old select are both detected';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
