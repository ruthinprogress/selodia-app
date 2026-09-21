// SAYING IT INSTEAD OF TAPPING IT.
//
// Ruth, 21 September 2026: "the chat should be able to fill it in directly from
// just speaking", and, on why the day matters, "I rarelt rememebr to add it to
// my calendar on the day it started or ended."
//
// Everything here guards a date or a scale. A wrong date in cycle_events is not
// a wrong row, it is a wrong cycle length, which is a wrong prediction for
// months. A mood stored against the wrong scale is a fortnight of numbers that
// look comparable and are not.
//
//   npx tsx scripts/probe-spoken-day.mjs

import {
  cycleEventType,
  cycleSaved,
  feelingSaved,
  rating,
  readSpokenCycle,
  daysFrom,
  LONGEST_SPAN_DAYS,
  readSpokenFeeling,
  spokenDay,
  spokenDayLabel,
} from '../app/lib/spoken-day.ts';
import { MEASURE_WORDS, wordFor } from '../app/lib/feeling-logging.ts';
import { MEASURES } from '../mobile/src/lib/daily-ratings.ts';

let passed = 0;
let failed = 0;

function group(name) {
  console.log(`\n  ${name.toUpperCase()}\n`);
}

function check(name, got, want) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        got  ${a}`);
    console.log(`        want ${b}`);
  }
}

const TODAY = '2026-09-21'; // A Monday.

group('the day somebody named');

check('a real date', spokenDay('2026-09-15', TODAY), '2026-09-15');
check('today itself', spokenDay(TODAY, TODAY), TODAY);
// NOTHING IN THE FUTURE. A period has not started tomorrow; that reading is a
// misread of "next Tuesday", and a future row would sit in the average forever.
check('tomorrow is refused', spokenDay('2026-09-22', TODAY), null);
check('next year is refused', spokenDay('2027-01-04', TODAY), null);
// A WEEKDAY RESOLVED INTO LAST YEAR is the mistake nobody spots until a cycle
// average goes strange months later.
check('more than a year back is refused', spokenDay('2025-09-01', TODAY), null);
check('just under a year back is kept', spokenDay('2025-10-01', TODAY), '2025-10-01');
check('not a date', spokenDay('Tuesday', TODAY), null);
check('a timestamp is not a day', spokenDay('2026-09-15T10:00:00Z', TODAY), null);
check('nothing', spokenDay(undefined, TODAY), null);
check('a number', spokenDay(20260915, TODAY), null);

group('which cycle events exist');

check('a start', cycleEventType('period_start'), 'period_start');
check('an end', cycleEventType('period_end'), 'period_end');
check('spotting', cycleEventType('spotting'), 'spotting');
// AN INVENTED TYPE IS DROPPED, not stored and not corrected into the nearest
// one. "ovulation" guessed at is a fact about somebody's body nobody observed.
check('an invented type', cycleEventType('ovulation'), null);
check('a near miss', cycleEventType('period-start'), null);
check('nothing', cycleEventType(undefined), null);

group('reading a spoken cycle event');

check('her exact case, said on the Friday about the Tuesday', readSpokenCycle({ cycleEvent: 'period_start', cycleDate: '2026-09-15' }, TODAY), {
  type: 'period_start',
  day: '2026-09-15',
});
// A DAY NOBODY NAMED IS TODAY, which is what "my period started" means when
// said without a day.
check('no day given', readSpokenCycle({ cycleEvent: 'period_start' }, TODAY), { type: 'period_start', day: TODAY });
// A BAD DATE FALLS BACK TO TODAY RATHER THAN BEING WRITTEN. The event did
// happen - they said so - and today is the only day we actually know about.
check('a future day falls back to today', readSpokenCycle({ cycleEvent: 'period_end', cycleDate: '2026-12-01' }, TODAY), {
  type: 'period_end',
  day: TODAY,
});
check('no event, nothing to write', readSpokenCycle({ cycleDate: '2026-09-15' }, TODAY), null);
check('an invented event writes nothing', readSpokenCycle({ cycleEvent: 'ovulation', cycleDate: '2026-09-15' }, TODAY), null);

group('the one-to-five scale');

check('the bottom', rating(1), 1);
check('the top', rating(5), 5);
check('a string the model sent', rating('3'), 3);
check('rounded', rating(3.4), 3);
check('zero is not on the scale', rating(0), null);
check('six is not on the scale', rating(6), null);
// A MODEL INVENTING A TEN-POINT SCALE is the failure this catches: 8 out of 10
// stored as an 8 would read as off the end of a five-word scale forever.
check('eight out of ten is refused', rating(8), null);
check('nonsense', rating('quite good'), null);
check('nothing', rating(undefined), null);

group('reading a spoken feeling');

check('both measures', readSpokenFeeling({ feelingMood: 2, feelingEnergy: 1, feelingNote: 'second bad night' }, TODAY), {
  day: TODAY,
  through: TODAY,
  mood: 2,
  energy: 1,
  note: 'second bad night',
});
// ONE MEASURE IS NOT BOTH. Saying they are shattered says nothing about their
// mood, and filling the other column in would manufacture the record this whole
// feature exists to check AI observations against.
check('energy alone leaves mood empty', readSpokenFeeling({ feelingEnergy: 1 }, TODAY), {
  day: TODAY,
  through: TODAY,
  mood: null,
  energy: 1,
  note: null,
});
check('a past day', readSpokenFeeling({ feelingMood: 4, feelingDate: '2026-09-19' }, TODAY), {
  day: '2026-09-19',
  through: '2026-09-19',
  mood: 4,
  energy: null,
  note: null,
});
// NEITHER MEASURE MEANS NO ROW. A note on its own is a sentence about a day,
// which the conversation already keeps; writing it as a rating would put a
// blank in every chart that reads this table.
check('a note with no rating', readSpokenFeeling({ feelingNote: 'busy week' }, TODAY), null);
check('nothing at all', readSpokenFeeling({}, TODAY), null);
check('an off-scale rating is not a rating', readSpokenFeeling({ feelingMood: 9 }, TODAY), null);
check('an empty note is no note', readSpokenFeeling({ feelingMood: 3, feelingNote: '   ' }, TODAY), {
  day: TODAY,
  through: TODAY,
  mood: 3,
  energy: null,
  note: null,
});

group('a stretch of days, which is how people talk');

// "Im sure other verbal ranges are quite common." They are: all week, since the
// weekend, the last few days, for a fortnight, all last week.
check('one day', daysFrom('2026-09-21', '2026-09-21'), ['2026-09-21']);
check('a weekend', daysFrom('2026-09-19', '2026-09-21'), ['2026-09-19', '2026-09-20', '2026-09-21']);
check('across a month end', daysFrom('2026-09-30', '2026-10-01'), ['2026-09-30', '2026-10-01']);
check('a week is seven days', daysFrom('2026-09-15', '2026-09-21').length, 7);
// BACKWARDS IS A MISREADING, not a range.
check('ending before it starts', daysFrom('2026-09-21', '2026-09-15'), []);
// A MONTH IS AS FAR AS ONE SENTENCE REACHES. "Tired since January" is a feeling
// about a season, and 260 identical rows would bury every day she logged.
check('a month exactly', daysFrom('2026-08-22', '2026-09-21').length, LONGEST_SPAN_DAYS);
check('longer than a month is refused', daysFrom('2026-01-01', '2026-09-21'), []);
check('nonsense', daysFrom('whenever', 'later'), []);

check('all week', readSpokenFeeling({ feelingEnergy: 1, feelingDate: '2026-09-15', feelingThrough: TODAY }, TODAY), {
  day: '2026-09-15',
  through: TODAY,
  mood: null,
  energy: 1,
  note: null,
});
// A STRETCH THAT ENDED BEFORE TODAY. "I was low all last week" does not reach
// now, and saying it does would claim something about this week nobody said.
check('all last week', readSpokenFeeling({ feelingMood: 1, feelingDate: '2026-09-07', feelingThrough: '2026-09-13' }, TODAY).through, '2026-09-13');
// AN IMPOSSIBLE SPAN COLLAPSES TO THE DAY SHE NAMED rather than being dropped:
// losing six days is a gap, writing two hundred is a fabrication.
check('a backwards span keeps the named day', readSpokenFeeling({ feelingMood: 2, feelingDate: '2026-09-19', feelingThrough: '2026-09-17' }, TODAY).through, '2026-09-19');
check('an over-long span keeps the named day', readSpokenFeeling({ feelingMood: 2, feelingDate: '2026-01-02', feelingThrough: TODAY }, TODAY).through, '2026-01-02');

group('the sentence that is two facts on two days');

// RUTH CAUGHT THIS FROM THE DESCRIPTION ALONE, before it ever ran: "What's
// going to differentiate feeling tired actually today, vs when logging period
// start day". She was right - the two shared one date field, so the tiredness
// in a sentence like this one would have been filed under Tuesday.
// HER SECOND CORRECTION, the same evening: "'been shattered ever since'
// actually means that all days, including the period started day were
// fatigued" - and on where it stops, "Upto Today."
const bothInOne = {
  cycleEvent: 'period_start',
  cycleDate: '2026-09-15',
  feelingEnergy: 1,
  feelingDate: '2026-09-15',
  feelingThrough: TODAY,
};
check('the period is dated Tuesday', readSpokenCycle(bothInOne, TODAY), {
  type: 'period_start',
  day: '2026-09-15',
});
check('and the tiredness covers Tuesday to today', readSpokenFeeling(bothInOne, TODAY), {
  day: '2026-09-15',
  through: TODAY,
  mood: null,
  energy: 1,
  note: null,
});
// AND THE DATES DO NOT LEAK THE OTHER WAY EITHER.
const feltLastWeek = { cycleEvent: 'period_start', feelingMood: 2, feelingDate: '2026-09-19' };
check('a period today', readSpokenCycle(feltLastWeek, TODAY).day, TODAY);
check('beside a mood named for Saturday', readSpokenFeeling(feltLastWeek, TODAY).day, '2026-09-19');
// A CYCLE EVENT IS NOT A STATEMENT ABOUT HOW SOMEBODY FEELS. Nothing may be
// inferred into the other table from it.
check('a period alone writes no feeling', readSpokenFeeling({ cycleEvent: 'period_start', cycleDate: '2026-09-15' }, TODAY), null);
check('a feeling alone writes no cycle event', readSpokenCycle({ feelingMood: 2 }, TODAY), null);

group('the words, which must be the screen’s words');

check('the bottom of mood', wordFor('mood', 1), 'Low');
check('the top of energy', wordFor('energy', 5), 'Buzzing');
check('off the end', wordFor('mood', 9), null);
check('a measure that does not exist', wordFor('focus', 3), null);

// THE DRIFT GUARD. The server writes the number; the Feeling screen draws the
// word. If those two lists ever disagree, "Flat" tapped and "flat" spoken store
// different values and a fortnight of ratings becomes two scales wearing one
// name. Nothing else in the codebase would notice, so this does.
for (const m of MEASURES) {
  check(`${m.id}: server and screen agree`, MEASURE_WORDS[m.id], m.words);
}
check('the screen has no measure the server cannot write', MEASURES.map((m) => m.id), Object.keys(MEASURE_WORDS));

group('what she is told');

check(
  'today needs no date',
  cycleSaved({ type: 'period_start', day: TODAY }, TODAY, spokenDayLabel),
  'Period start recorded for today · Log › Cycle'
);
// A DAY IN THE PAST IS NAMED BACK, so a misheard Tuesday is visible in the
// confirmation rather than three months later in a prediction.
check(
  'a past day is named back',
  cycleSaved({ type: 'period_start', day: '2026-09-15' }, TODAY, spokenDayLabel),
  'Period start recorded for Tuesday 15 September · Log › Cycle'
);
check('a day reads as a person would say it', spokenDayLabel('2026-09-15'), 'Tuesday 15 September');

check(
  'both measures, in words not numbers',
  feelingSaved({ day: TODAY, through: TODAY, mood: 2, energy: 1, note: null }, TODAY, spokenDayLabel, wordFor),
  'Noted for today: mood flat, energy drained · Log › How you felt'
);
// A SPAN IS SAID BACK AS A SPAN, so a week filled in from one sentence is
// visible in the confirmation rather than discovered later in a chart.
check(
  'a stretch says so',
  feelingSaved({ day: '2026-09-15', through: TODAY, mood: null, energy: 1, note: null }, TODAY, spokenDayLabel, wordFor),
  'Noted for Tuesday 15 September to today: energy drained · Log › How you felt'
);
check(
  'one measure on a past day',
  feelingSaved({ day: '2026-09-19', through: '2026-09-19', mood: null, energy: 4, note: null }, TODAY, spokenDayLabel, wordFor),
  'Noted for Saturday 19 September: energy lively · Log › How you felt'
);

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
