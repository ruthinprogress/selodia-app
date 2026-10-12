// A SPOKEN CATCH-UP LEAVES ONE ENTRY PER THING EATEN, NAMED AS FOOD.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-voice-catch-up.mjs
//
// Ruth, 12 October 2026, catching up her Sunday by voice: "Sunday went weird,
// titles were what I said instead of food items and looks like cinnamon buns
// were counted twice. It's messy and also incorrect." Her Sunday read 3,921 kcal.
//
// Four faults, each checked here against the shape of that evening (with the
// foods kept and everything personal taken out):
//
//   1. a corrected entry was named with her whole sentence;
//   2. "Sunday 11 Oct:" became the start of a food's name, and three words the
//      duplicate guard could not see past;
//   3. a final "yes, that's right" re-logged two meals as one new entry, which
//      matched neither on its own;
//   4. "instead of the other ice cream" corrected the old bowl into a copy of
//      the new one, rather than letting the new one replace it;
//   and the sentence-growing guard missed versions with one revised word, or
//   more than 30 seconds apart.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { stripDayLabel, sameMeal, restatesEntries, contentWords } = await import(root + '/app/lib/food-dedupe.ts');
const { buildFoodRows, namedFromItems } = await import(root + '/app/lib/food-logging.ts');
const { continues, SUPERSEDE_WINDOW_MS } = await import(root + '/app/lib/voice-supersede.ts');

const logging = readFileSync('app/lib/food-logging.ts', 'utf8').split('\r\n').join('\n');

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

const SENTENCE = 'Yeah, instead of the other ice cream. It was just two bowls of ice cream with banana and raisins.';
const ICE = 'Bowl of ice cream with banana and raisins';

console.log('\n  A SPOKEN CATCH-UP LEAVES ONE ENTRY PER THING EATEN\n');

check('a day label is not part of the food', () => {
  assert.strictEqual(stripDayLabel('Sunday 11 Oct: two bowls of ice cream'), 'two bowls of ice cream');
  assert.strictEqual(stripDayLabel('Yesterday: fish and chips'), 'fish and chips');
  assert.strictEqual(stripDayLabel('Mon 7th: pizza'), 'pizza');
  // Labels that are not days stay.
  assert.strictEqual(stripDayLabel('Breakfast: porridge'), 'Breakfast: porridge');
  assert.strictEqual(stripDayLabel('Note: no sugar'), 'Note: no sugar');
  assert.strictEqual(stripDayLabel('Two bowls of ice cream'), 'Two bowls of ice cream');
  return 'days removed, other labels kept';
});

check('a catch-up row is named without its day', () => {
  const rows = buildFoodRows(
    { entries: [{ entry_text: 'Sunday 11 Oct: 300g raisins and 50g walnuts', detected_date: '2026-10-11', kcal: 1000, items: [{ name: 'Raisins' }] }] },
    'whatever she said',
    new Date('2026-10-12T19:36:59Z')
  );
  assert.strictEqual(rows[0].rawText, '300g raisins and 50g walnuts');
  return `"${rows[0].rawText}"`;
});

check('the same dessert in different words is the same dessert', () => {
  assert.strictEqual(sameMeal(`${ICE} (2)`, 'two bowls of ice cream with banana and raisins')?.how, 'same');
  assert.strictEqual(sameMeal('Sunday: two bowls of ice cream with banana', '2 bowl of ice cream with banana')?.how, 'same');
  assert.ok(contentWords('Sunday 11 Oct').size <= 1, 'day words still count as food');
  return 'number words, plurals and days see through';
});

check('a corrected entry is named as food, never as her sentence', () => {
  assert.strictEqual(namedFromItems([{ name: ICE }, { name: ICE }]), `${ICE} (2)`);
  assert.strictEqual(namedFromItems([]), null);
  assert.ok(
    /const named = correctionOf \? corrected \?\? namedFromItems\(items\) \?\? correctionOf : corrected \?\? foodText;/.test(logging),
    'a correction can still fall back to the whole sentence'
  );
  assert.ok(/raw_text: stripDayLabel\(named\)/.test(logging), 'the corrected name is not the one written');
  return 'foods, then the old name, never the sentence';
});

check('a final "yes" that re-logs two meals as one is dropped', () => {
  const recent = [
    { logId: 'ice', names: [ICE, ICE] },
    { logId: 'buns', names: ['Fresh homemade cinnamon buns'] },
  ];
  const combined = ['Ice cream with banana and raisins', 'Ice cream with banana and raisins', 'Cinnamon bun, homemade', 'Cinnamon bun, homemade'];
  assert.deepStrictEqual(restatesEntries(combined, recent)?.sort(), ['buns', 'ice']);
  return 'both meals recognised, nothing added';
});

check('but something new among them is logged', () => {
  const recent = [{ logId: 'ice', names: [ICE] }, { logId: 'buns', names: ['Cinnamon buns'] }];
  assert.strictEqual(restatesEntries(['Ice cream with banana and raisins', 'Cinnamon bun', 'Popcorn with honey'], recent), null);
  // "Another bowl of ice cream" on its own is a second bowl, and is logged.
  assert.strictEqual(restatesEntries(['Ice cream with banana and raisins'], recent), null);
  // And a one-word food only matches itself: banana is not banana bread.
  assert.strictEqual(restatesEntries(['Banana bread', 'Coffee'], [{ logId: 'b', names: ['Banana'] }, { logId: 'c', names: ['Coffee'] }]), null);
  return 'new food, a single repeat and a near-name all kept';
});

check('a correction that makes a copy removes its own entry', () => {
  assert.ok(/A CORRECTION THAT MAKES A COPY REMOVES ITS OWN ENTRY/.test(logging), 'there is no twin check after a correction');
  assert.ok(
    /sameMeal\(r\.raw_text \?\? '', stripDayLabel\(named\)\)\?\.how === 'same'/.test(logging),
    'the twin check does not compare the corrected name'
  );
  assert.ok(/\.neq\('id', updateLogId\)/.test(logging), 'the twin check could find the entry itself');
  return 'the corrected copy goes, the other stands';
});

check('the restatement guard runs where rows are written', () => {
  assert.ok(/const restated = restatesEntries\(/.test(logging), 'restatesEntries is never called');
  assert.ok(/untouched\.push\(\.\.\.restated\)/.test(logging), 'a restating entry is not treated as already there');
  return 'in the write loop';
});

check('a growing sentence with one revised word is the same sentence', () => {
  const a = "Yeah, so let's fill it. When else today on Sunday? Remind me.";
  const b = "Yeah, so let's fill it. What else today on Sunday? Remind me. Did we have the ice cream in there?";
  assert.strictEqual(continues(a, b), true);
  // A short opening is still exact: "Two eggs" is not "Ten eggs".
  assert.strictEqual(continues('Two eggs', 'Ten eggs on toast'), false);
  // Two revised words is a different sentence.
  assert.strictEqual(continues('I had a big bowl of yogurt today', 'You had a big plate of yogurt today with honey'), false);
  assert.ok(SUPERSEDE_WINDOW_MS >= 60_000, 'a sentence remembered over 48 seconds is still two sentences');
  return 'one revision in eight, sixty seconds';
});

check('and this check can fail', () => {
  // THE OLD continues(): every opening word exact.
  const exact = (a, b) => {
    const w = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
    const x = w(a);
    const y = w(b);
    if (x.length === 0 || y.length <= x.length) return false;
    for (let i = 0; i < Math.min(8, x.length); i++) if (x[i] !== y[i]) return false;
    return true;
  };
  assert.strictEqual(
    exact("Yeah, so let's fill it. When else today", "Yeah, so let's fill it. What else today, remind me"),
    false,
    'the old rule would have passed, so the revision test proves nothing'
  );
  // THE OLD fallback named the entry with her sentence.
  const oldNamed = (corrected, foodText) => corrected ?? foodText;
  assert.strictEqual(oldNamed(null, SENTENCE), SENTENCE);
  return 'the old rules produce tonight’s faults';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
