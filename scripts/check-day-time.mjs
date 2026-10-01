// WHAT TIME DID SHE MEAN, AND WHAT SHOULD THE PILL SAY?
//
//   node --import ./scripts/ts-paths.mjs scripts/check-day-time.mjs
//
// Ruth, 1 October 2026, UI items 3 and 4: chronological order within a day, and
// a planned time shown as exact (19:30), approximate (~09:00) or not at all.
//
// `time_of_day` is free text and stays free text, so everything here is derived
// on the way out. Two things can go wrong and both are quiet:
//
//   A TIME INVENTED. "Evening" ordered correctly and then DISPLAYED as "~18:30"
//   would be the app telling her she said something she did not. The sort key and
//   the label are separate for exactly this reason, and the checks below hold
//   them apart rather than trusting that they stay apart.
//
//   A TIME MISREAD. "7pm" as 07:00 puts her French class twelve hours out, and
//   the week still looks perfectly tidy. am/pm, midnight and noon are where this
//   goes wrong, so they are each pinned.
//
// EVERY GROUP IS PROVED ABLE TO FAIL at the bottom. See MUTATION.

import assert from 'node:assert';

import { byTimeOfDay, clockLabel, pillDetail, plannedTime } from '../mobile/src/lib/day-time.ts';

let pass = 0;
const failures = [];
function check(group, name, fn) {
  try {
    fn();
    pass += 1;
  } catch (e) {
    failures.push(`${group} / ${name}: ${e.message}`);
  }
}

const GROUPS = {};

// ------------------------------------------------------------------- a clock

GROUPS.clock = (parse) => {
  const at = (s) => parse(s);

  check('clock', 'the shapes somebody actually types', () => {
    assert.equal(at('19:30').label, '19:30');
    assert.equal(at('7pm').label, '19:00');
    assert.equal(at('7:30pm').label, '19:30');
    assert.equal(at('9.30am').label, '09:30');
    assert.equal(at('7 pm').label, '19:00');
    assert.equal(at('19h30').label, '19:30');
    assert.equal(at('09:00').label, '09:00');
  });

  check('clock', 'noon and midnight, where am/pm goes wrong', () => {
    assert.equal(at('12pm').label, '12:00', 'midday is 12:00, not 00:00');
    assert.equal(at('12am').label, '00:00', 'midnight is 00:00, not 12:00');
    assert.equal(at('12:30am').label, '00:30');
  });

  check('clock', 'a stated time carries NO tilde', () => {
    // The tilde means she hedged. Putting one on a time she stated says she was
    // vaguer than she was.
    assert.equal(at('7pm').approximate, false);
    assert.equal(at('19:30').label.startsWith('~'), false);
  });

  check('clock', 'a hedged time carries one', () => {
    assert.equal(at('around 9').label, '~09:00');
    assert.equal(at('9ish').label, '~09:00');
    assert.equal(at('about 7pm').label, '~19:00');
    assert.equal(at('roughly 19:00').label, '~19:00');
    assert.equal(at('~09:00').label, '~09:00');
    assert.equal(at('around 9').approximate, true);
  });

  check('clock', 'it sorts by the real time of day', () => {
    assert.equal(at('7pm').minutes, 19 * 60);
    assert.equal(at('09:00').minutes, 9 * 60);
    assert.ok(at('7pm').minutes > at('09:00').minutes, '7pm must come after 09:00');
  });

  check('clock', 'a BARE number is not a time unless she hedged it', () => {
    // "Gym 9" could be nine reps, nine o'clock, or a machine. Guessing puts a
    // wrong time on her week, and a wrong time looks exactly as tidy as a right
    // one.
    assert.notEqual(at('gym 9').kind, 'clock');
    assert.equal(at('around 9').kind, 'clock');
  });

  check('clock', 'nonsense is not silently accepted as a clock', () => {
    assert.notEqual(at('99:99').kind, 'clock');
    assert.notEqual(at('25:00').kind, 'clock');
  });

  check('clock', 'HH:MM formatting', () => {
    assert.equal(clockLabel(0), '00:00');
    assert.equal(clockLabel(9 * 60), '09:00');
    assert.equal(clockLabel(19 * 60 + 30), '19:30');
    assert.equal(clockLabel(23 * 60 + 59), '23:59');
  });
};

// ------------------------------------------------------------- her own words

GROUPS.words = (parse) => {
  check('words', 'a part of the day shows HER WORD, never a clock', () => {
    // The single most important check in this file. A nominal bucket exists so
    // "evening" can be ordered; if it ever reaches the label, the app has put a
    // time in her mouth.
    for (const said of ['evening', 'Morning', 'lunchtime', 'after work', 'night']) {
      const t = parse(said);
      assert.equal(t.kind, 'partOfDay', `${said} should be a part of the day`);
      assert.equal(t.label, said, `${said} must display as itself, got ${t.label}`);
      assert.doesNotMatch(t.label, /\d\d:\d\d/, `${said} displayed a clock: ${t.label}`);
    }
  });

  check('words', 'but a part of the day still ORDERS', () => {
    // This is what buys the rhythm. Without it "evening" and "morning" are
    // equally unplaced and the day reads in whatever order the rows arrived.
    const morning = parse('morning').minutes;
    const afternoon = parse('afternoon').minutes;
    const evening = parse('evening').minutes;
    assert.ok(morning !== null && afternoon !== null && evening !== null, 'all three need a key');
    assert.ok(morning < afternoon, 'morning before afternoon');
    assert.ok(afternoon < evening, 'afternoon before evening');
  });

  check('words', 'a part of the day interleaves with stated times', () => {
    // A 10:00 class should land after "morning" coffee and before an "evening"
    // one, or the ordering is two separate lists pretending to be one.
    const ten = parse('10:00').minutes;
    assert.ok(parse('morning').minutes < ten, 'morning before 10:00');
    assert.ok(ten < parse('evening').minutes, '10:00 before evening');
  });

  check('words', 'a phrase she invented is shown as she wrote it', () => {
    const t = parse('after the school run');
    assert.equal(t.label, 'after the school run');
    assert.doesNotMatch(t.label, /\d\d:\d\d/);
  });

  check('words', 'a clock beats a part of the day when she gave both', () => {
    // "Thursday evening at 7pm" - she said both and the specific one is the one
    // worth showing.
    assert.equal(parse('evening at 7pm').label, '19:00');
  });

  check('words', 'nothing said shows nothing', () => {
    for (const empty of [null, undefined, '', '   ']) {
      const t = parse(empty);
      assert.equal(t.label, null, `${JSON.stringify(empty)} produced a label`);
      assert.equal(t.minutes, null);
    }
  });
};

// ------------------------------------------------------------- the pill line

GROUPS.detail = (detail) => {
  check('detail', 'time and duration, joined', () =>
    assert.equal(detail('~9am', '60 mins'), '~09:00 · 60 mins')
  );
  check('detail', 'a time with no duration', () => assert.equal(detail('19:30', null), '19:30'));
  check('detail', 'a duration with no time', () => assert.equal(detail(null, '60 mins'), '60 mins'));
  check('detail', 'neither is empty, not a stray separator', () => {
    // A lone "·" on a card is the kind of thing that makes a page feel unfinished.
    assert.equal(detail(null, null), '');
    assert.equal(detail('', '  '), '');
  });
};

// ------------------------------------------------------------- the day's order

GROUPS.order = (sort) => {
  const row = (activity, time_of_day) => ({ activity, time_of_day });

  check('order', "her Thursday, from the brief", () => {
    // Ruth's own example: French 10:00 then Gym ~19:00.
    const sorted = sort([row('Gym', '~7pm'), row('French', '10:00')]);
    assert.deepEqual(sorted.map((r) => r.activity), ['French', 'Gym']);
  });

  check('order', 'anything without a time sorts LAST, not first', () => {
    // The timed things are the spine of the day. A no-time card at the top
    // pushes the actual schedule down the screen.
    const sorted = sort([row('Yoga', null), row('Gym', '09:00')]);
    assert.deepEqual(sorted.map((r) => r.activity), ['Gym', 'Yoga']);
  });

  check('order', 'equal times keep the order she arranged', () => {
    // Stability. A sort that reshuffles equal items between renders makes a page
    // feel broken in a way nobody can put their finger on.
    const sorted = sort([row('B', '09:00'), row('A', '09:00'), row('C', '09:00')]);
    assert.deepEqual(sorted.map((r) => r.activity), ['B', 'A', 'C']);
  });

  check('order', 'two untimed cards keep their order too', () => {
    const sorted = sort([row('B', null), row('A', null)]);
    assert.deepEqual(sorted.map((r) => r.activity), ['B', 'A']);
  });

  check('order', 'words and clocks order together', () => {
    const sorted = sort([
      row('Evening class', 'evening'),
      row('Swim', '07:00'),
      row('Whenever', null),
      row('Coffee', 'morning'),
    ]);
    assert.deepEqual(
      sorted.map((r) => r.activity),
      ['Swim', 'Coffee', 'Evening class', 'Whenever']
    );
  });

  check('order', 'it does not mutate what it was given', () => {
    const input = [row('B', '19:00'), row('A', '09:00')];
    sort(input);
    assert.equal(input[0].activity, 'B', 'the caller\'s array was reordered in place');
  });
};

// ----------------------------------------------------------------------- RUN

GROUPS.clock(plannedTime);
GROUPS.words(plannedTime);
GROUPS.detail(pillDetail);
GROUPS.order(byTimeOfDay);

// ------------------------------------------------------------------- MUTATION

const EMPTY = {
  clock: () => ({ kind: 'none', minutes: null, label: null, approximate: false }),
  words: () => ({ kind: 'none', minutes: null, label: null, approximate: false }),
  detail: () => '',
  order: (rows) => rows,
};

const mutationFailures = [];
for (const [name, run] of Object.entries(GROUPS)) {
  const before = failures.length;
  const realPass = pass;
  run(EMPTY[name]);
  const broke = failures.length > before;
  failures.length = before;
  pass = realPass;
  if (!broke) {
    mutationFailures.push(
      `${name}: every check still passed against an implementation that answers nothing.`
    );
  }
}

for (const f of failures) console.error('  FAIL  ' + f);
for (const f of mutationFailures) console.error('  USELESS  ' + f);
console.log(`\n  ${pass} passed, ${failures.length} failed, ${mutationFailures.length} useless`);
if (failures.length + mutationFailures.length > 0) process.exit(1);
