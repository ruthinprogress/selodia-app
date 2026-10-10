// ONE CYCLE, ONE BAR.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-cycle-bars.mjs
//
// Ruth, 9 October 2026, on the cycle history: "it's just a long list atm."
//
// Built on her real cycle lengths - 29, 24, 35, 26, 31 - because the point of
// the bars is showing that 24 followed 35, and a check on a tidy 28-day
// fixture would prove nothing about the case that matters.
//
// THE TWO THINGS A LIST CANNOT DO, both checked:
//   - show that cycles differ in length
//   - show a month where nothing happened at all, which in perimenopause is
//     among the most meaningful things there is

import assert from 'node:assert';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { cycleBars, cycleSummary, summaryLines, isGap } = await import(
  root + '/mobile/src/lib/cycle-bars.ts'
);

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

const ev = (d, t) => ({ event_date: d, event_type: t });

// Her five cycles, with ends on most of them.
const EVENTS = [
  ev('2026-05-04', 'period_start'), ev('2026-05-08', 'period_end'),
  ev('2026-06-02', 'period_start'), ev('2026-06-06', 'period_end'),
  ev('2026-06-26', 'period_start'), ev('2026-07-01', 'period_end'),
  ev('2026-07-31', 'period_start'), ev('2026-08-03', 'period_end'),
  ev('2026-08-26', 'period_start'),
  ev('2026-09-26', 'period_start'), ev('2026-09-30', 'period_end'),
];
const TODAY = '2026-10-13';

console.log('\n  ONE CYCLE, ONE BAR\n');

check('her real lengths come out, newest first', () => {
  const bars = cycleBars(EVENTS, TODAY).filter((b) => !isGap(b));
  const lengths = bars.map((b) => b.length);
  assert.deepStrictEqual(lengths, [null, 31, 26, 35, 24, 29], JSON.stringify(lengths));
  assert.strictEqual(bars[0].soFar, 18, 'the open cycle should be on day 18');
  return 'open at day 18, then 31, 26, 35, 24, 29';
});

check('and this check can fail', () => {
  // The assertions are about a shape that an empty result would not have, but
  // prove the empty case is handled and that a tidy fixture reads differently.
  assert.deepStrictEqual(cycleBars([], TODAY), [], 'no events should give no bars');
  const regular = cycleBars(
    [ev('2026-01-01', 'period_start'), ev('2026-01-29', 'period_start')],
    '2026-02-01'
  ).filter((b) => !isGap(b));
  assert.deepStrictEqual(regular.map((b) => b.length), [null, 28]);
  return 'no events gives nothing; a regular 28 reads as 28';
});

check('a bleed with no end marked is null, never guessed', () => {
  const bars = cycleBars(EVENTS, TODAY).filter((b) => !isGap(b));
  const august = bars.find((b) => b.start === '2026-08-26');
  assert.strictEqual(august.bleed, null, 'a missing end was filled in');
  const september = bars.find((b) => b.start === '2026-09-26');
  assert.strictEqual(september.bleed, 5, '26 Sep to 30 Sep is five days');
  return 'August null, September 5';
});

check('a skipped month is a row, not an absence', () => {
  // Nothing between 4 May and 2 September: June, July and August are empty.
  const sparse = [
    ev('2026-05-04', 'period_start'),
    ev('2026-09-02', 'period_start'),
  ];
  const bars = cycleBars(sparse, '2026-09-20');
  const gaps = bars.filter(isGap);
  assert.strictEqual(gaps.length, 3, `expected June, July, August; got ${gaps.map((g) => g.label)}`);
  assert.deepStrictEqual(gaps.map((g) => g.label), ['Aug 2026', 'Jul 2026', 'Jun 2026']);
  return 'three empty months, each its own row';
});

check('an ordinary month-to-month cycle is not called a gap', () => {
  // 30 January to 2 March crosses February without skipping it.
  const bars = cycleBars(
    [ev('2026-01-30', 'period_start'), ev('2026-03-02', 'period_start')],
    '2026-03-10'
  );
  assert.strictEqual(bars.filter(isGap).length, 0, 'invented a skipped month');
  return 'crossing a month is not skipping one';
});

check('a cycle is filed under the month its period started', () => {
  // Ruth, 9 October: "i think the month the period starts is the month it's
  // assigned to". 26 September to 26 October is September's.
  const bars = cycleBars(EVENTS, TODAY).filter((b) => !isGap(b));
  assert.strictEqual(bars.find((b) => b.start === '2026-09-26').label, 'Sept 2026');
  assert.strictEqual(bars.find((b) => b.start === '2026-06-26').label, 'Jun 2026');
  return 'a cycle spanning two months takes the first';
});

check('the summary says what the bars show', () => {
  const lines = summaryLines(cycleSummary(cycleBars(EVENTS, TODAY)));
  assert.ok(lines, 'no summary produced');
  assert.strictEqual(lines[0], 'You are on day 18 of this cycle.');
  assert.ok(/Your last three were 31, 26 and 35 days\./.test(lines[1]), lines[1]);
  assert.ok(/A range of 24 to 35\./.test(lines[2]), lines[2]);
  return lines.join(' ');
});

check('it never predicts the next period', () => {
  const lines = summaryLines(cycleSummary(cycleBars(EVENTS, TODAY))) ?? [];
  const said = lines.join(' ');
  assert.ok(
    !/due|expect|next period|predict|should start/i.test(said),
    `the summary predicts: ${said}`
  );
  return 'a range and a day number, no date';
});

check('one cycle says what it can and no more', () => {
  const lines = summaryLines(cycleSummary(cycleBars([ev('2026-10-01', 'period_start')], '2026-10-13')));
  assert.deepStrictEqual(lines, ['You are on day 13 of this cycle.']);
  // No average, no range, no "your last three" from a sample of none.
  return 'the day, and nothing invented around it';
});

check('no period ever logged says nothing at all', () => {
  assert.strictEqual(summaryLines(cycleSummary([])), null);
  return 'null, not a zero';
});

// HER REAL SEPTEMBER, 10 October 2026. Two period starts six days apart became
// a "6 day cycle" on her phone, and that one row then produced "Your last three
// were 6, 28 and 28 days" and "A range of 6 to 28" - a spread saying her cycle
// is wildly irregular when it is not.
//
// EVERY ASSERTION ABOVE PASSED THROUGHOUT. They were built on her five real
// lengths, all plausible, so none of them could see a rule that did not exist.
// cycle-history had excluded intervals like this from its averages since it was
// written; this file's module had no lower bound at all, and it was the one she
// could see.
const SEPT = [
  { event_date: '2026-06-01', event_type: 'period_start' },
  { event_date: '2026-06-29', event_type: 'period_start' },
  { event_date: '2026-07-27', event_type: 'period_start' },
  { event_date: '2026-08-24', event_type: 'period_start' },
  // The pair. Six days apart: one period, logged twice.
  { event_date: '2026-09-21', event_type: 'period_start' },
  { event_date: '2026-09-27', event_type: 'period_start' },
];

check('two starts too close together are one period, not a six-day cycle', () => {
  const bars = cycleBars(SEPT, '2026-10-10');
  const lengths = bars.filter((b) => !isGap(b)).map((b) => b.length).filter((n) => n !== null);
  assert.ok(!lengths.includes(6), `a six-day cycle is still being drawn: ${lengths.join(', ')}`);
  // NEWEST FIRST, AND AUGUST IS NOW 34. My first version of this expected
  // [28, 28, 28] and the code was right: absorbing the 21st into the 27th
  // means the August cycle genuinely ran 24 August to 27 September. That is
  // the honest consequence of deciding the later date is the real start, and
  // a 34-day cycle is a thing her body did rather than a thing the merge
  // invented. Pretending it was still 28 would be the actual error.
  assert.deepStrictEqual(lengths, [34, 28, 28, 28], `got ${lengths.join(', ')}`);
  return 'the pair folded in, August reads 34';
});

check('the later date wins, so the bars and the day count agree', () => {
  // cycle-history reads the LATEST start as the current cycle's start and says
  // "day 14" on 10 October. If the merge kept the earlier date the bars would
  // say day 20 underneath that sentence.
  const open = cycleBars(SEPT, '2026-10-10').find((b) => b.soFar !== null);
  assert.strictEqual(open.start, '2026-09-27', `open cycle starts ${open.start}`);
  assert.strictEqual(open.soFar, 14, `day ${open.soFar}, not 14`);
  return 'open cycle starts 27 Sept, day 14';
});

check('nothing is deleted - the absorbed date is carried so she can fix it', () => {
  const open = cycleBars(SEPT, '2026-10-10').find((b) => b.soFar !== null);
  assert.deepStrictEqual(open.alsoStarted, ['2026-09-21']);
  // And an ordinary row carries none, or every row would be warning about nothing.
  const ordinary = cycleBars(SEPT, '2026-10-10').filter((b) => b.length === 28);
  for (const b of ordinary) assert.deepStrictEqual(b.alsoStarted, [], `${b.label} invented a duplicate`);
  return 'the 21st is kept on the row, and only there';
});

check('and this check can fail', () => {
  // Prove the rule is a rule and not an artefact of these dates: a genuinely
  // short cycle ABOVE the bound must survive, or the fix would be quietly
  // deleting the short cycles that matter most in perimenopause.
  const short = [
    { event_date: '2026-06-01', event_type: 'period_start' },
    { event_date: '2026-06-18', event_type: 'period_start' }, // 17 days: short, real
    { event_date: '2026-07-16', event_type: 'period_start' },
  ];
  const lengths = cycleBars(short, '2026-07-20')
    .filter((b) => !isGap(b))
    .map((b) => b.length)
    .filter((n) => n !== null);
  assert.ok(lengths.includes(17), `a real 17-day cycle was swallowed: ${lengths.join(', ')}`);
  // And the summary stops claiming a range it no longer has evidence for.
  const lines = summaryLines(cycleSummary(cycleBars(SEPT, '2026-10-10')));
  assert.ok(
    !lines.some((l) => l.includes('6 to 28')),
    `the range is still wrong: ${lines.join(' ')}`
  );
  return '17 days kept, "a range of 6 to 28" gone';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
