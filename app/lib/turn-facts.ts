// EVERY NUMBER WORKED OUT IN CODE, ROUNDED AS THE SCREEN ROUNDS, AND LABELLED.
//
// Ruth, 27 September 2026, item 10 point 3: "All numbers computed in code,
// rounded to match the screen, passed as labelled facts. All eight data blocks,
// not just measurements."
//
// WHAT WAS WRONG, established by reading the code rather than guessing. Six of
// the eight blocks were raw rows turned into sentences. The measurement one was
// literally:
//
//     humanDate(m.measured_at) + ': weight ' + m.weight_kg + 'kg'
//
// with `m.weight_kg` UNROUNDED - so the model saw 55.58 where her screen showed
// 55.6, worked out the change from 56.9 itself, and printed 1.4 against the
// screen's 1.3. The app knew the answer and made the model guess it.
//
// Every wrong comparison in the weekly roundup came from the same place:
// "almost no movement" over 2,262-9,820 steps, "very little logged water"
// beside "averaging 1,681 ml", "a week of higher intake" beside "under 1,400
// kcal on average". A model doing arithmetic on prose, unaided, in a document
// about somebody's body.
//
// THE TWO RULES THIS FILE KEEPS.
//
// 1. ROUND FIRST, THEN COMPARE. The screen rounds each figure to one decimal
//    place, and those are the only numbers she can check by looking. A figure
//    she cannot reproduce from her own screen is wrong even when the arithmetic
//    is right.
//
// 2. AN ABSENCE IS A FACT AND IS SAID OUT LOUD. "Nothing logged" is never left
//    to be inferred from a short list, because a list somebody has to NOTICE is
//    empty is what produced "you had a hard session a day or two ago".

type Food = { happened_at: string; raw_text: string; kcal: number | null; protein_g: number | null };
type Activity = {
  happened_at: string;
  activity_type: string | null;
  duration_min: number | null;
  kcal_burned: number | null;
  intensity: string | null;
};
type DailyBurn = { date: string; steps: number | null; kcal_burned: number | null; active_minutes: number | null };
type Drink = { ml: number | null; happened_at: string };
type Sleep = { night_of: string; duration_min: number | null; quality: string | null; awakenings: number | null };
type Measurement = { measured_at: string; weight_kg: number | null; body_fat_pct: number | null };

export type TurnData = {
  food: Food[];
  activity: Activity[];
  dailyBurn: DailyBurn[];
  drinks: Drink[];
  sleep: Sleep[];
  measurements: Measurement[];
  lastPeriodStart: string | null;
  /** How many days each block covers. Seven typed, three spoken. */
  days: number;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const whole = (n: number) => Math.round(n);

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayName(key: string): string {
  const d = new Date(key + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Group rows by their local day, newest day first. */
function byDay<T>(rows: T[], when: (r: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = dayKey(when(r));
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

function sum(values: (number | null)[]): number {
  return values.reduce((n: number, v) => n + (v ?? 0), 0);
}

/** The mean over the days that HAVE something, never over a fixed seven. */
function meanPerLoggedDay(days: [string, unknown[]][], total: (rows: never[]) => number): number | null {
  const logged = days.filter(([, rows]) => rows.length > 0);
  if (logged.length === 0) return null;
  return sum(logged.map(([, rows]) => total(rows as never[]))) / logged.length;
}

function block(title: string, lines: string[], empty: string): string {
  if (lines.length === 0) return `${title}\n  ${empty}`;
  return `${title}\n${lines.map((l) => `  ${l}`).join('\n')}`;
}

export function foodFacts(rows: Food[], days: number): string {
  const grouped = byDay(rows, (r) => r.happened_at);
  const avgKcal = meanPerLoggedDay(grouped, (rs: Food[]) => sum(rs.map((r) => r.kcal)));
  const avgProtein = meanPerLoggedDay(grouped, (rs: Food[]) => sum(rs.map((r) => r.protein_g)));

  const lines = grouped.map(([key, rs]) => {
    const kcal = whole(sum(rs.map((r) => r.kcal)));
    const protein = whole(sum(rs.map((r) => r.protein_g)));
    const items = rs.map((r) => r.raw_text).filter(Boolean).join('; ');
    return `${dayName(key)}: ${kcal.toLocaleString('en-GB')} kcal, ${protein} g protein — ${items}`;
  });

  const head =
    grouped.length === 0
      ? `FOOD, last ${days} days: nothing logged on any day.`
      : `FOOD, last ${days} days: logged on ${grouped.length} of ${days} days. Daily average ON LOGGED DAYS ${whole(avgKcal ?? 0).toLocaleString('en-GB')} kcal and ${whole(avgProtein ?? 0)} g protein. That average covers only the days with something on them — a day with nothing logged is a day she did not record, never a day she did not eat.`;
  return block(head, lines, 'nothing logged.');
}

export function movementFacts(activity: Activity[], burn: DailyBurn[], days: number): string {
  const sessions = byDay(activity, (r) => r.happened_at);
  const steps = burn.filter((b) => typeof b.steps === 'number');
  const stepValues = steps.map((b) => b.steps as number);
  const avgSteps = stepValues.length > 0 ? whole(sum(stepValues) / stepValues.length) : null;

  const lines: string[] = [];
  for (const b of [...burn].sort((a, b2) => b2.date.localeCompare(a.date))) {
    const onDay = sessions.find(([k]) => k === dayKey(b.date))?.[1] ?? [];
    const named = onDay
      .map((a) => {
        const bits = [
          a.duration_min != null ? `${whole(a.duration_min)} min` : null,
          a.intensity ?? null,
          a.kcal_burned != null ? `${whole(a.kcal_burned)} kcal` : null,
        ].filter(Boolean);
        return `${a.activity_type ?? 'movement'}${bits.length ? ` (${bits.join(', ')})` : ''}`;
      })
      .join('; ');
    lines.push(
      `${dayName(dayKey(b.date))}: ${b.steps != null ? `${b.steps.toLocaleString('en-GB')} steps` : 'steps not recorded'}${named ? `, and ${named}` : ', no session logged'}`
    );
  }

  const sessionCount = activity.length;
  const head =
    stepValues.length === 0 && sessionCount === 0
      ? `MOVEMENT, last ${days} days: nothing at all is recorded — no steps and no sessions. You may not say she trained, exercised or had a hard session. There is nothing in the record to say it from.`
      : `MOVEMENT, last ${days} days: ${sessionCount} ${sessionCount === 1 ? 'session' : 'sessions'} logged${avgSteps != null ? `, and steps on ${stepValues.length} of ${days} days averaging ${avgSteps.toLocaleString('en-GB')}` : ', and no step counts recorded'}. STEPS ARE MOVEMENT: a day with steps and no session is not a day without movement, and must never be described as one.`;
  return block(head, lines, 'nothing recorded.');
}

export function waterFacts(rows: Drink[], days: number): string {
  const grouped = byDay(rows, (r) => r.happened_at);
  const avg = meanPerLoggedDay(grouped, (rs: Drink[]) => sum(rs.map((r) => r.ml)));
  const lines = grouped.map(([key, rs]) => `${dayName(key)}: ${whole(sum(rs.map((r) => r.ml))).toLocaleString('en-GB')} ml`);
  const head =
    grouped.length === 0
      ? `WATER, last ${days} days: nothing logged.`
      : `WATER, last ${days} days: logged on ${grouped.length} of ${days} days, averaging ${whole(avg ?? 0).toLocaleString('en-GB')} ml on those days. A day with nothing logged means nothing was tapped, NOT that she drank nothing — never describe an unlogged day as a dry one, and do not call an average low or high, just say what it is.`;
  return block(head, lines, 'nothing logged.');
}

export function sleepFacts(rows: Sleep[], days: number): string {
  const lines = [...rows]
    .sort((a, b) => b.night_of.localeCompare(a.night_of))
    .map((n) => {
      const bits = [
        n.duration_min != null ? `${round1(n.duration_min / 60)} hours` : null,
        n.quality ?? null,
        n.awakenings != null ? `woke ${n.awakenings} ${n.awakenings === 1 ? 'time' : 'times'}` : null,
      ].filter(Boolean);
      return `night of ${dayName(n.night_of)}: ${bits.join(', ') || 'recorded, no detail'}`;
    });
  const head =
    rows.length === 0
      ? `SLEEP, last ${days} days: nothing logged. A night that is not here was not recorded, which says nothing about how she slept — never read a gap as a bad night or a good one.`
      : `SLEEP, last ${days} days: ${rows.length} ${rows.length === 1 ? 'night' : 'nights'} recorded. A night that is not here was not recorded, which says nothing about how she slept.`;
  return block(head, lines, 'nothing logged.');
}

export function measurementFacts(rows: Measurement[], days: number): string {
  const weighed = rows.filter((r) => r.weight_kg != null).sort((a, b) => b.measured_at.localeCompare(a.measured_at));

  const lines = weighed.map((r) => {
    const bits = [`${round1(r.weight_kg as number)} kg`];
    if (r.body_fat_pct != null) bits.push(`${round1(r.body_fat_pct)}% body fat`);
    return `${dayName(dayKey(r.measured_at))}: ${bits.join(', ')}`;
  });

  // THE COMPARISON, DONE HERE. Round each figure first and THEN subtract, which
  // is what the screen does; rounding the difference instead gives a number she
  // cannot reproduce by looking at her own readings.
  let change = '';
  if (weighed.length >= 2) {
    const latest = round1(weighed[0].weight_kg as number);
    const earliest = round1(weighed[weighed.length - 1].weight_kg as number);
    const delta = round1(latest - earliest);
    const apart = Math.round(
      (Date.parse(dayKey(weighed[0].measured_at)) - Date.parse(dayKey(weighed[weighed.length - 1].measured_at))) /
        86_400_000
    );
    change = ` From ${earliest} kg on ${dayName(dayKey(weighed[weighed.length - 1].measured_at))} to ${latest} kg on ${dayName(dayKey(weighed[0].measured_at))}: ${delta > 0 ? '+' : ''}${delta} kg across ${apart} ${apart === 1 ? 'day' : 'days'}. USE THAT FIGURE EXACTLY AND DO NOT WORK OUT YOUR OWN.`;
  }

  const head =
    weighed.length === 0
      ? `WEIGH-INS, last ${days} days: none. So nothing can be called a rise, a fall or a trend.`
      : `WEIGH-INS, last ${days} days: ${weighed.length}.${change}${weighed.length < 4 ? ' That is too few to call a trend — say what the figures are and leave it there.' : ''} Count WEIGH-INS, never the number of individual values across them.`;
  return block(head, lines, 'none.');
}

export function cycleFacts(lastPeriodStart: string | null, today: Date): string {
  if (!lastPeriodStart) return 'CYCLE: no period start logged, so there is no cycle day and none may be guessed.';
  const start = Date.parse(lastPeriodStart + 'T00:00:00Z');
  const now = Date.parse(dayKey(today.toISOString()) + 'T00:00:00Z');
  const day = Math.round((now - start) / 86_400_000) + 1;
  if (!(day >= 1 && day <= 45)) {
    return `CYCLE: the last period start on record is ${dayName(lastPeriodStart)}, which is too long ago to count a cycle day from. Do not offer one.`;
  }
  return `CYCLE: day ${day}, counting from the period that started on ${dayName(lastPeriodStart)}.`;
}

/**
 * Everything above, as one block.
 *
 * ONE FUNCTION SO THERE IS ONE ANSWER. The old prompt built six summaries in
 * six places in a 2,700-line route, which is six places for one of them to
 * quietly go back to prose.
 */
export function turnFacts(data: TurnData, today: Date = new Date()): string {
  return [
    foodFacts(data.food, data.days),
    movementFacts(data.activity, data.dailyBurn, data.days),
    waterFacts(data.drinks, data.days),
    sleepFacts(data.sleep, data.days),
    measurementFacts(data.measurements, data.days),
    cycleFacts(data.lastPeriodStart, today),
  ].join('\n\n');
}
