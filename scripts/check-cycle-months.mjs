// THE CYCLE SCREEN BECAME A RECORD YOU CAN READ.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-cycle-months.mjs
//
// Ruth's artwork, 21 October 2026, eight screens. The screen before it was a
// period button, a door and a row of bars: it recorded a cycle and could not
// be read. Her drawing lists her months newest first, each one opening onto a
// summary of that cycle and each day of it onto what she logged.
//
// WHAT IS ACTUALLY AT RISK HERE, and it is not the layout. Every figure on
// these screens is a claim about her own body, and the three ways to get one
// wrong are all quiet:
//
//   A LENGTH THAT WAS GUESSED. A cycle is only as long as the gap to the next
//   recorded start. The one she is in has no length at all, only a day number.
//
//   A BLEED THAT WAS AVERAGED. "End not logged" is the commonest gap in this
//   record - she built the end button herself because of it - and filling it
//   with a typical four days would turn a hole into a fact she would then plan
//   around.
//
//   AN END PAIRED WITH THE WRONG START. A stray end row recorded after the next
//   period began would report a bleed longer than the cycle holding it.
//
// None of those would look like a bug. They would look like her body.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { cycleMonths, byYear, monthTitles, rowDetail, rowLength, cyclePattern, bleedLength, endDayOptions, LONGEST_BLEED } =
  await import(here('mobile/src/lib/cycle-months.ts'));
const { monthSummary, dayLine, dayOfCycle, shortDay, endDate } = await import(
  here('mobile/src/lib/cycle-month-detail.ts')
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

// Her drawing's own example, as events: four closed cycles, one with no end
// recorded, and a current one running.
const EVENTS = [
  ev('2026-06-01', 'period_start'), ev('2026-06-05', 'period_end'),
  ev('2026-06-29', 'period_start'), ev('2026-07-03', 'period_end'),
  ev('2026-07-27', 'period_start'), ev('2026-07-31', 'period_end'),
  ev('2026-08-25', 'period_start'), ev('2026-08-28', 'period_end'),
  ev('2026-09-28', 'period_start'),
  ev('2026-10-19', 'period_start'),
];
const TODAY = '2026-10-21';

console.log('\n  THE CYCLE RECORD\n');

check('THE THREE STATES HER DRAWING NAMES', () => {
  const rows = cycleMonths(EVENTS, TODAY);
  const titles = monthTitles(rows);
  const say = (i) => `${titles[i]} ${rowLength(rows[i])} ${rowDetail(rows[i])}`;

  // Ongoing: a day number and no length.
  assert.strictEqual(rows[0].lengthDays, null, 'the cycle she is in was given a length');
  assert.strictEqual(say(0), 'October Day 3 Ongoing', say(0));

  // Complete, but the bleed is unknown. The gap is named, never filled.
  assert.strictEqual(rows[1].bleedDays, null, 'a bleed was invented for a cycle with no end');
  assert.strictEqual(say(1), 'September 21 days End not logged', say(1));

  // Complete and whole.
  assert.strictEqual(say(2), 'August 34 days 4 days bleed', say(2));
  return 'ongoing, end-not-logged, whole';
});

check('AND AN END BELONGS TO THE START IT FOLLOWS', () => {
  // A stray end after the next period began is not this period's end. Pairing
  // them would report a bleed longer than the cycle that held it.
  const stray = [
    ev('2026-08-25', 'period_start'),
    ev('2026-09-28', 'period_start'),
    ev('2026-10-02', 'period_end'),
  ];
  assert.strictEqual(
    bleedLength(stray, '2026-08-25', '2026-09-28'),
    null,
    "a later cycle's end was counted as August's bleed"
  );
  assert.strictEqual(bleedLength(stray, '2026-09-28', null), 5, 'the end did not land on its own start');
  // And the end of the day it started on is one day, not zero.
  assert.strictEqual(
    bleedLength([ev('2026-08-25', 'period_start'), ev('2026-08-25', 'period_end')], '2026-08-25', null),
    1,
    'a one-day bleed counted as none'
  );
  return 'bounded by the next start, inclusive of both ends';
});

check('TWO CYCLES IN ONE MONTH ARE NOT ONE ROW SAID TWICE', () => {
  // A short cycle after a long month is all it takes, and the first run of this
  // printed "June" twice, which reads as a bug rather than as two cycles.
  const titles = monthTitles(cycleMonths(EVENTS, TODAY));
  const junes = titles.filter((t) => t.startsWith('June'));
  assert.strictEqual(junes.length, 2, 'the two June cycles are not both listed');
  assert.notStrictEqual(junes[0], junes[1], `both are called "${junes[0]}"`);
  assert.deepStrictEqual(junes, ['June 29', 'June 1'], junes.join(' / '));
  // And a month with only one cycle keeps its plain name, as the drawing has it.
  assert.ok(titles.includes('August'), 'a lone month was given a day it does not need');
  return 'June 29 and June 1, August left alone';
});

check('A YEAR IS A HEADING, NOT A FILTER', () => {
  const rows = cycleMonths(
    [ev('2025-12-20', 'period_start'), ev('2026-01-18', 'period_start'), ev('2026-02-14', 'period_start')],
    '2026-02-20'
  );
  const years = byYear(rows);
  assert.deepStrictEqual(
    years.map((y) => `${y.year}:${y.months.length}`),
    ['2026:2', '2025:1'],
    years.map((y) => `${y.year}:${y.months.length}`).join(', ')
  );
  return 'newest year first, nothing dropped';
});

check('THE PATTERN CARD IS HER SHORTEST AND HER LONGEST', () => {
  // Not the average plus a margin. knowledgeFrom holds half the spread, which
  // is the right shape for "give or take" and the wrong one for this card: she
  // wants two facts, not an interval.
  const p = cyclePattern(EVENTS);
  assert.strictEqual(p.cycles, 5);
  assert.strictEqual(p.shortest, 21);
  assert.strictEqual(p.longest, 34);
  assert.ok(p.average >= p.shortest && p.average <= p.longest, 'the average sits outside the range');
  // And nothing at all before there is anything to average.
  assert.strictEqual(cyclePattern([ev('2026-10-19', 'period_start')]), null, 'one start produced a pattern');
  return `${p.cycles} cycles, ${p.shortest}-${p.longest}, average ${p.average}`;
});

check('THE MONTH CARD COUNTS, IT DOES NOT ESTIMATE', () => {
  const rows = cycleMonths(EVENTS, TODAY);
  const august = rows.find((r) => r.start === '2026-08-25');
  const days = [
    { day: '2026-08-25', flow: 'heavy', symptoms: ['cramps', 'bloating'], mucus: null, notes: null },
    { day: '2026-08-26', flow: 'heavy', symptoms: ['headache', 'bloating'], mucus: null, notes: null },
    { day: '2026-08-27', flow: 'medium', symptoms: ['bloating'], mucus: null, notes: null },
    { day: '2026-08-28', flow: 'light', symptoms: ['headache'], mucus: null, notes: null },
  ];
  const s = monthSummary(august, EVENTS, '2026-09-28', days);
  assert.strictEqual(s.lengthLabel, '34-day cycle');
  assert.strictEqual(s.bleedLabel, '4-day bleed');
  // The month is said once where both days share it, as her drawing has it.
  assert.strictEqual(s.periodLabel, '25 – 28 Aug', s.periodLabel);
  assert.strictEqual(s.loggedDays, 4, 'the logged days are not the rows she wrote');

  // MOST COMMON MEANS MOST COMMON. A symptom named once is not common, and a
  // list that included it would be a list of everything - which is the state
  // the old screen was in and what she called "just a long list".
  assert.deepStrictEqual(
    s.common.map((c) => `${c.name} (${c.count})`),
    ['bloating (3)', 'headache (2)'],
    s.common.map((c) => c.name).join(', ')
  );
  assert.ok(!s.common.some((c) => c.name === 'cramps'), 'a symptom named once is listed as common');
  const crossing = monthSummary(
    { ...august, start: '2026-08-30' },
    [ev('2026-08-30', 'period_start'), ev('2026-09-02', 'period_end'), ev('2026-09-28', 'period_start')],
    '2026-09-28',
    []
  );
  assert.strictEqual(crossing.periodLabel, '30 Aug – 2 Sep', crossing.periodLabel);
  return '34 days, 4-day bleed, 4 logged, 2 common';
});

check('AND ONE DAY IS ONE VOTE', () => {
  // A symptom written twice on the same day is still one day of it. Counting
  // entries rather than days would make a fiddly morning look like a bad week.
  const rows = cycleMonths(EVENTS, TODAY);
  const august = rows.find((r) => r.start === '2026-08-25');
  const s = monthSummary(august, EVENTS, '2026-09-28', [
    { day: '2026-08-25', flow: 'heavy', symptoms: ['bloating', 'bloating', 'Bloating '], mucus: null, notes: null },
    { day: '2026-08-26', flow: 'light', symptoms: ['bloating'], mucus: null, notes: null },
  ]);
  const bloating = s.common.find((c) => c.name === 'bloating');
  assert.strictEqual(bloating?.count, 2, `counted ${bloating?.count} rather than 2 days`);
  return 'repeats on one day count once';
});

check('A DAY READS AS A LINE, AND AN EMPTY DAY SAYS NOTHING', () => {
  assert.strictEqual(
    dayLine({ day: '2026-08-25', flow: 'light', symptoms: ['bloating'], mucus: null, notes: null }),
    'Light flow · Bloating'
  );
  // Nothing invented for a day that holds only a note.
  assert.strictEqual(
    dayLine({ day: '2026-08-25', flow: null, symptoms: [], mucus: null, notes: 'took an antihistamine' }),
    'Note'
  );
  assert.strictEqual(
    dayLine({ day: '2026-08-25', flow: null, symptoms: null, mucus: null, notes: null }),
    '',
    'an empty day was given a line'
  );
  assert.strictEqual(dayOfCycle('2026-08-25', '2026-08-27'), 3, 'the start is not day one');
  assert.strictEqual(dayOfCycle('2026-08-25', '2026-08-24'), null, 'a day before the start got a number');
  assert.strictEqual(shortDay('2026-08-25'), '25 Aug');
  assert.strictEqual(endDate('2026-08-25', 4), '2026-08-28', 'four days of bleeding ended on the wrong day');
  return 'flow leads, nothing invented';
});

check('AND A START IN THE FUTURE NEVER PRINTS A NEGATIVE DAY', () => {
  // She can record a start on a day she chooses, and a fat finger on next week
  // should not produce "Day -4" at the top of her screen.
  const rows = cycleMonths([ev('2026-10-25', 'period_start')], TODAY);
  assert.strictEqual(rows[0].dayOfCycle, 1, `printed day ${rows[0].dayOfCycle}`);
  return 'day one at worst';
});

check('AND A PERIOD CAN BE CLOSED LONG AFTER IT ENDED', () => {
  // Ruth, 21 October 2026: "there is no way to say when the period in September
  // ended." She was right, and the gap had a shape: the end could only ever be
  // recorded from the Cycle screen's own action, which offers the last fourteen
  // days from TODAY. So a September period could be closed during September and
  // never afterwards - while its row went on printing "End not logged" with no
  // way to answer it, which is the worst kind of thing for an app to say.
  const days = endDayOptions('2026-09-27', '2026-10-19', '2026-10-21');
  assert.ok(days.length > 0, 'a period weeks ago can still not be closed');
  assert.strictEqual(days[0], '2026-09-27', 'a one-day period cannot be recorded');
  // NEVER PAST THE NEXT PERIOD. An end after that is not this period's end, and
  // bleedLength would refuse it afterwards anyway - so it is not offered.
  assert.ok(days.every((d) => d < '2026-10-19'), 'a day in the next cycle was offered as this one\'s end');
  // THE BOUND ONLY BITES WHEN THE NEXT PERIOD BEGAN INSIDE THE FOURTEEN DAYS,
  // which the first version of this check never exercised - fourteen days from
  // 27 September stop well short of 19 October on their own, so the assertion
  // above passed with the bound removed entirely.
  const tight = endDayOptions('2026-09-27', '2026-10-01', '2026-10-21');
  assert.deepStrictEqual(
    tight,
    ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30'],
    tight.join(', ')
  );
  assert.ok(days.length <= LONGEST_BLEED, `${days.length} days offered`);

  // AND NEVER IN THE FUTURE. A period cannot have ended on a day that has not
  // happened, and the current cycle is the one where that is reachable.
  const current = endDayOptions('2026-10-19', null, '2026-10-21');
  assert.deepStrictEqual(current, ['2026-10-19', '2026-10-20', '2026-10-21'], current.join(', '));
  return 'from the period, not from today';
});

check('AND THE CYCLE SHE DELETES TAKES ITS END WITH IT', () => {
  // A stray end left behind attaches to the cycle BEFORE this one: bleedLength
  // bounds an end by the next start, and with this start gone the previous one
  // reaches straight through it. The row she deleted would come back as a wrong
  // bleed length on a row she never touched.
  const screen = fs.readFileSync('mobile/src/app/(tabs)/log/cycle-month.tsx', 'utf8');
  const at = screen.indexOf('async function deleteCycle');
  assert.ok(at > -1, 'there is still no way to delete a cycle in the app');
  const body = screen.slice(at, at + 1600);
  assert.ok(/'period_end'/.test(body), 'deleting a cycle leaves its end behind');
  assert.ok(/'period_start'/.test(body), 'the start is not deleted');
  // The bound itself, not merely the word: "nextStart" appears elsewhere in
  // this function and kept the loose version of this assertion green.
  assert.ok(
    /\.lt\('event_date', nextStart\)/.test(body),
    'the end deletion is not bounded by the next cycle'
  );
  // AND IT ASKS FIRST. Removing a period start changes a row she did not touch.
  // THE QUESTION IS THE ONLY DOOR. Asserting that the word "confirming"
  // appears is not the same claim and stayed true when the button was wired
  // straight to the delete.
  assert.ok(
    /onPress=\{\(\) => setConfirming\(true\)\}/.test(screen),
    'a cycle is deleted on one unguarded tap'
  );
  const ways = [...screen.matchAll(/void deleteCycle\(\)/g)];
  assert.strictEqual(ways.length, 1, `${ways.length} ways to reach the delete`);
  // WHAT SHE LOGGED ON THOSE DAYS IS HERS. A symptom is an observation about a
  // date, not a possession of the cycle that happened to contain it.
  assert.ok(
    !/daily_observations/.test(body),
    'deleting a cycle also deletes what she logged on those days'
  );
  return 'start and end, bounded, after asking';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
