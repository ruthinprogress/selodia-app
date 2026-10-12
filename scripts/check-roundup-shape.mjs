// THE WEEKLY ROUNDUP READS AS A NOTE, AND ITS CARD ADDS UP.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-roundup-shape.mjs
//
// Ruth, 12 October 2026, on her roundup: "Needs much nicer formatting. This is a
// very important part of Selodía's usp and right now it feels like spam. The
// report beneath is cool, but needs sharper language. Eg. 'A day nobody' is
// weird."
//
// And the card said "+0.4 kg" over a week that went from 56.4 to 56.05: the
// readings were sorted by their day NAMES, and Friday comes before Tuesday.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { shapeRoundup, ROUNDUP_LINES_PER_HEADING } = await import(root + '/app/lib/roundup-prompt.ts');
const { roundupFigures } = await import(root + '/app/lib/roundup-figures.ts');
const { weekDelta } = await import(root + '/app/lib/weekly-roundup.ts');

const route = readFileSync('app/api/weekly-roundup/route.ts', 'utf8').split('\r\n').join('\n');

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

console.log('\n  THE WEEKLY ROUNDUP READS AS A NOTE, AND ITS CARD ADDS UP\n');

check('a week that went down says it went down', () => {
  // Her three readings, with the day written in words as the route writes it.
  const readings = [
    { date: 'Tuesday 6 October', value: 56.4, at: Date.parse('2026-10-06T07:00:00Z') },
    { date: 'Thursday 8 October', value: 56.2, at: Date.parse('2026-10-08T07:00:00Z') },
    { date: 'Friday 9 October', value: 56.05, at: Date.parse('2026-10-09T07:00:00Z') },
  ];
  const d = weekDelta(readings);
  assert.strictEqual(d.first.value, 56.4, `first reading was ${d.first.date}`);
  assert.strictEqual(d.last.value, 56.05, `last reading was ${d.last.date}`);
  assert.ok(d.change < 0, `the change was ${d.change}`);
  assert.ok(/value: r\.value, at: r\.at/.test(route), 'the route does not pass the moment, so the sort falls back to names');
  return `${d.first.value} to ${d.last.value}`;
});

check('the weigh-in row adds up and says what it means', () => {
  const rows = roundupFigures({
    fullDays: 6, avgKcal: { value: 1917, confidence: null }, avgProtein: { value: 77, confidence: null },
    delta: { first: { value: 56.4, date: 'Tue' }, last: { value: 56.05, date: 'Fri' }, change: -0.4, readingCount: 3 },
    readingCount: 3, activity: [], drinkDayTotals: [1600, 1600, 1600, 1600], stepDays: [3000],
  });
  const w = rows.find((r) => r.label === 'Weigh-ins');
  assert.strictEqual(w.value, '3 readings, 56.4 to 56.05 kg (-0.35 kg)');
  assert.strictEqual(w.note, 'within normal day-to-day change');
  // A real change on too few readings still says so.
  const big = roundupFigures({
    fullDays: 7, avgKcal: null, avgProtein: null,
    delta: { first: { value: 60, date: 'Mon' }, last: { value: 61.5, date: 'Sun' }, change: 1.5, readingCount: 3 },
    readingCount: 3, activity: [], drinkDayTotals: [], stepDays: [],
  }).find((r) => r.label === 'Weigh-ins');
  assert.strictEqual(big.note, 'too few to show a trend');
  const drinks = rows.find((r) => r.label === 'Drinks');
  assert.strictEqual(drinks.note, 'average of the 4 logged days');
  assert.strictEqual(rows.find((r) => r.label === 'Food').note, 'average of the 6 logged days');
  for (const r of rows) {
    assert.ok(!/nobody recorded|position rather than|draw much from|not the week/.test(`${r.value} ${r.note ?? ''}`), `old wording on ${r.label}`);
  }
  return 'every note says what it means';
});

const SPAM = `Six of seven days had food logged, and steps were recorded every day.

Friday the 9th stands out as the one day with movement logged.

You asked more than once this week about saturated fat.

How has the dizziness been?`;

const OVERFULL = `Here is your week.

**What stood out**
- Friday: a run and an hour of yoga on the same day.
- You asked twice about saturated fat.
- You were awake at 4am on the 7th.
- A fourth point that should not be here.
Some stray paragraph that should not be here.

**Worth watching**
- Dizziness three days running, which you said you would keep an eye on.

How has the dizziness been since?
Anything else?`;

check('an overfull reply is cut to the shape', () => {
  const out = shapeRoundup(OVERFULL);
  const lines = out.split('\n');
  assert.strictEqual(lines[0], '**What stood out**', 'something came before the first heading');
  assert.ok(!/fourth point|stray paragraph|Here is your week/.test(out), 'overflow survived');
  const bullets = lines.filter((l) => l.startsWith('- ')).length;
  assert.strictEqual(bullets, ROUNDUP_LINES_PER_HEADING + 1);
  assert.strictEqual(lines[lines.length - 1], 'Anything else?');
  return `${bullets} lines and one question`;
});

check('a long line keeps its fact and loses its tail', () => {
  const long = `**Worth watching**
- You mentioned feeling less lean and called this stretch a break from a deficit rather than a problem - worth keeping an eye on how that feeling sits with you as the weeks go on.

How are you?`;
  const out = shapeRoundup(long);
  assert.ok(out.includes('- You mentioned feeling less lean and called this stretch a break from a deficit rather than a problem.'), out);
  assert.ok(!/worth keeping an eye/.test(out), 'the tail survived');
  // A short line with a dash is left alone.
  assert.ok(shapeRoundup(`**What stood out**
- Friday - a run and yoga.

Ok?`).includes('- Friday - a run and yoga.'));
  return 'cut at the dash, only when too long';
});

check('a reply with no headings is left whole rather than guessed at', () => {
  assert.strictEqual(shapeRoundup(SPAM), SPAM.trim());
  return 'unchanged';
});

check('the route cuts every roundup before storing it', () => {
  assert.ok(/shapeRoundup\(result\.reply\)/.test(route), 'the reply is stored as the model wrote it');
  return 'at the write';
});

check('and this check can fail', () => {
  // THE OLD SORT: by the words.
  const byName = [{ date: 'Tuesday 6 October', value: 56.4 }, { date: 'Friday 9 October', value: 56.05 }]
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  assert.strictEqual(byName[0].value, 56.05, 'sorting by name no longer puts Friday first, so the first test proves nothing');
  return 'the old sort put Friday before Tuesday';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
