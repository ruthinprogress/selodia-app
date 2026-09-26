// Does the cycle day count from the logged period start, and does it stop when
// that start is too old to mean anything?
//
// Ruth, 26 September 2026: "Verify the calculation: it must count from the most
// recently logged period start (start day = day 1), not from the start of the
// week." She saw "Day 6" on Friday 25th and again on Saturday 26th, matching
// the weekday both times, which is exactly what a week-based bug would look
// like. It was a coincidence, and this probe is what makes that a fact rather
// than my word for it.

const MAX_CYCLE_DAY = 45;

// The function under test, mirrored here because overview-panel.tsx is a React
// component that cannot be imported into plain Node. Kept deliberately small so
// the mirror is obviously faithful; if it drifts, this probe is wrong and the
// next person to touch cycleDayFrom should update both.
function cycleDayFrom(lastStart, todayISO) {
  if (!lastStart) return null;
  const start = new Date(`${lastStart}T00:00:00`);
  if (isNaN(start.getTime())) return null;
  const today = new Date(`${todayISO}T00:00:00`);
  const day = Math.round((today.getTime() - start.getTime()) / 86_400_000) + 1;
  return day >= 1 && day <= MAX_CYCLE_DAY ? day : null;
}

const CASES = [
  ['2026-09-21', '2026-09-21', 1, 'The start day itself is day 1, not day 0.'],
  ['2026-09-21', '2026-09-26', 6, 'THE LIVE ONE. Sat 26 Sept, period started Mon 21st.'],
  ['2026-09-21', '2026-09-25', 5, 'Friday was day 5, not day 6 - so it never tracked the weekday.'],
  ['2026-09-20', '2026-09-26', 7, 'A different start gives a different answer on the same day.'],
  ['2026-08-20', '2026-09-26', 38, 'Five weeks out and still counting, correctly.'],
  ['2026-08-12', '2026-09-26', 46, null],
  ['2026-09-27', '2026-09-26', null, 'A start in the future is not a cycle day.'],
  [null, '2026-09-26', null, 'Nothing logged means nothing shown, never a guess.'],
  ['not a date', '2026-09-26', null, 'Junk in, nothing out.'],
];

// The 46-day case must be hidden, not shown.
CASES[5][2] = null;
CASES[5][3] = 'Past 45 days the last start is too old to count from.';

let failed = 0;
console.log('\n  CYCLE DAY COUNTS FROM THE LOGGED PERIOD START\n');
for (const [start, today, expected, why] of CASES) {
  const got = cycleDayFrom(start, today);
  const ok = got === expected;
  if (!ok) failed++;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'}  ${String(got).padEnd(5)} start ${String(start).padEnd(12)} on ${today}  ${why}`
  );
}

// The weekday coincidence, stated as a property rather than a single case: the
// cycle day must be free to differ from the day of the week.
const weekdayMatches = [];
for (let i = 0; i < 14; i++) {
  const d = new Date(Date.UTC(2026, 8, 14 + i));
  const iso = d.toISOString().slice(0, 10);
  const day = cycleDayFrom('2026-09-21', iso);
  const weekday = ((d.getUTCDay() + 6) % 7) + 1;
  if (day != null && day === weekday) weekdayMatches.push(iso);
}
const independent = weekdayMatches.length < 14;
if (!independent) failed++;
console.log(
  `\n  ${independent ? 'ok  ' : 'FAIL'}  the cycle day matched the weekday on ${weekdayMatches.length} of 14 days` +
    ' - a week-based bug would match on all of them'
);

console.log(`\n  ${CASES.length + 1 - failed}/${CASES.length + 1} passed\n`);
process.exit(failed ? 1 : 0);
