// THE WEEK, WORKED OUT ACROSS EVERY DOMAIN, SO THE MODEL CAN READ IT INSTEAD OF
// ADDING IT UP.
//
// Ruth, 14 October 2026, after the comparison run answered "what's the week
// looking like" with a paragraph where her other assistant had given a table:
//
//   "the useful answer is one that gives information that the user is currently
//    focusing on. My project gave a table becausse i was tracking the kals and
//    protein... In selodia, i'd just go an look at the weekly table with the
//    average at the bottom and i might ask something more like, if i stay on
//    this trjectory, what's the predicted fat loss this week."
//
// WHICH IS THE WHOLE DESIGN POINT. Her other assistant had no app around it, so
// every answer had to arrive as text. Selodia sits beside screens that already
// draw the food log with its weekly average at the bottom. A chat reply that
// redraws that screen in prose is worse than the screen and costs a turn.
//
// So the chat's job is the thing no screen can do: read ACROSS the domains.
// Then, widening it herself:
//
//   "it should really scan across all recorded data for the week and explain
//    anything that comes up. could be ovulation week, mood has been very high
//    due to exciting personal news, or ill and sedentary or anything that had
//    been recorded that has an effect on anything else"
//
// THE INTERACTION IS THE INSIGHT. Either fact alone is a number she can already
// see. Ovulation week beside a dip in energy, a sedentary stretch that turns out
// to be the week she was ill, training up and sleep down - those are the things
// no tab shows, because every tab shows one domain.
//
// WHY THE FIGURES ARE COMPUTED HERE AND NOT BY THE MODEL. The same rule the
// roundup card learned the hard way (see roundup-figures.ts): a model asked to
// average seven days of food in its head produced "under 1,400 kcal on average"
// over 1,222. Anything she could check on her own screen is worked out once, in
// code, and handed over as a figure. The model's job is the reading, never the
// arithmetic.
//
// AND IT ADDS NO ROUND TRIP. Every row below is already loaded for the turn, for
// other reasons. This only arranges what is there.

export type WeekInput = {
  food: { happened_at: string; kcal: number | null; protein_g: number | null }[];
  activity: { happened_at: string; activity_type: string | null; duration_min: number | null; intensity: string | null }[];
  dailyBurn: { date: string; steps: number | null; kcal_burned: number | null }[];
  drinks: { ml: number | null; happened_at: string }[];
  sleep: { night_of: string; duration_min: number | null; quality: string | null; awakenings: number | null }[];
  measurements: { measured_at: string; weight_kg: number | null; body_fat_pct: number | null }[];
  /** The day her last period started, for working out where in the cycle she is. */
  lastPeriod: string | null;
  /** Today, as YYYY-MM-DD in her own timezone. */
  today: string;
};

const DAY = 86_400_000;
const WINDOW = 7;

const dayOf = (iso: string): string => iso.slice(0, 10);
const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);

/** The seven dates ending today, oldest first. */
function windowDays(today: string): string[] {
  const end = Date.parse(`${today}T12:00:00Z`);
  if (!isFinite(end)) return [];
  return Array.from({ length: WINDOW }, (_, i) =>
    new Date(end - (WINDOW - 1 - i) * DAY).toISOString().slice(0, 10)
  );
}

function mean(xs: number[]): number | null {
  return xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

const round = (n: number): number => Math.round(n);
const one = (n: number): string => (Math.round(n * 10) / 10).toFixed(1);

/**
 * WHAT THE WEEK HOLDS, one line per domain, every absence stated.
 *
 * NOTHING IS LEFT OUT WHEN IT IS EMPTY, which is the rule turn-facts.ts and the
 * roundup card both keep: a block with no sleep line reads as an app that does
 * not track sleep, and a sleep line saying nothing was logged reads as the
 * truth. A reply once described a workout that never happened because a list
 * somebody had to NOTICE was short.
 */
export function weekReadBlock(input: WeekInput): string {
  const days = windowDays(input.today);
  if (days.length === 0) return '';
  const inWindow = (iso: string | null): boolean => !!iso && days.includes(dayOf(iso));

  // FOOD, per day, so an average is over the days she logged rather than seven.
  const kcalByDay = new Map<string, number>();
  const proteinByDay = new Map<string, number>();
  for (const f of input.food) {
    if (!inWindow(f.happened_at)) continue;
    const d = dayOf(f.happened_at);
    const k = num(f.kcal);
    const p = num(f.protein_g);
    if (k !== null) kcalByDay.set(d, (kcalByDay.get(d) ?? 0) + k);
    if (p !== null) proteinByDay.set(d, (proteinByDay.get(d) ?? 0) + p);
  }
  const loggedDays = [...kcalByDay.keys()].sort();
  const avgKcal = mean([...kcalByDay.values()]);
  const avgProtein = mean([...proteinByDay.values()]);

  // MOVEMENT. Sessions are things she set out and did; steps are the day going by.
  const sessions = input.activity.filter((a) => inWindow(a.happened_at));
  const sessionDays = new Set(sessions.map((a) => dayOf(a.happened_at)));
  const burn = input.dailyBurn.filter((b) => days.includes(b.date));
  const steps = burn.map((b) => num(b.steps)).filter((n): n is number => n !== null);

  // SLEEP, by the night it started.
  const nights = input.sleep.filter((s) => days.includes(dayOf(s.night_of)));
  const hours = nights
    .map((s) => num(s.duration_min))
    .filter((n): n is number => n !== null)
    .map((m) => m / 60);
  const shortNights = hours.filter((h) => h < 6).length;
  const wakings = nights.map((s) => num(s.awakenings)).filter((n): n is number => n !== null);

  // WATER, per day.
  const mlByDay = new Map<string, number>();
  for (const d of input.drinks) {
    if (!inWindow(d.happened_at)) continue;
    const ml = num(d.ml);
    if (ml !== null) mlByDay.set(dayOf(d.happened_at), (mlByDay.get(dayOf(d.happened_at)) ?? 0) + ml);
  }

  // BODY. Oldest and newest reading IN THE WINDOW, and only a movement when
  // there are two to compare.
  const readings = input.measurements
    .filter((m) => inWindow(m.measured_at) && num(m.weight_kg) !== null)
    .sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  const first = readings[0];
  const last = readings[readings.length - 1];

  const lines: string[] = [
    'THEIR WEEK, WORKED OUT FROM THEIR OWN ROWS. These figures are correct; do not recalculate them, and do not state a figure that is not here.',
    `Window: the 7 days ending ${input.today}.`,
  ];

  lines.push(
    loggedDays.length === 0
      ? 'Food: nothing logged this week.'
      : `Food: ${loggedDays.length} of 7 days logged` +
        (avgKcal !== null ? `, averaging ${round(avgKcal)} kcal` : '') +
        (avgProtein !== null ? ` and ${round(avgProtein)}g protein on those days` : '') +
        '.'
  );

  lines.push(
    sessions.length === 0
      ? 'Movement: no sessions logged this week.'
      : `Movement: ${sessions.length} session(s) across ${sessionDays.size} day(s) - ` +
        sessions
          .map((a) =>
            [a.activity_type ?? 'a session', a.duration_min ? `${a.duration_min} min` : null, a.intensity]
              .filter(Boolean)
              .join(' ')
          )
          .join('; ') +
        '.'
  );

  if (steps.length > 0) {
    lines.push(`Steps: ${round(mean(steps) as number)} a day on the ${steps.length} day(s) the phone recorded.`);
  }

  lines.push(
    nights.length === 0
      ? 'Sleep: nothing logged this week.'
      : `Sleep: ${nights.length} night(s) logged` +
        (hours.length > 0 ? `, averaging ${one(mean(hours) as number)} hours` : '') +
        (shortNights > 0 ? `, ${shortNights} of them under 6 hours` : '') +
        (wakings.length > 0 ? `, waking ${one(mean(wakings) as number)} times a night` : '') +
        '.'
  );

  lines.push(
    mlByDay.size === 0
      ? 'Water: nothing logged this week.'
      : `Water: ${round(mean([...mlByDay.values()]) as number)} ml a day on the ${mlByDay.size} day(s) logged.`
  );

  if (readings.length === 0) {
    lines.push('Body: no weigh-ins this week.');
  } else if (readings.length === 1) {
    lines.push(`Body: one reading, ${one(num(first.weight_kg) as number)} kg on ${dayOf(first.measured_at)}. One reading is not a trend.`);
  } else {
    const change = (num(last.weight_kg) as number) - (num(first.weight_kg) as number);
    lines.push(
      `Body: ${readings.length} readings, ${one(num(first.weight_kg) as number)} kg on ${dayOf(first.measured_at)} to ` +
        `${one(num(last.weight_kg) as number)} kg on ${dayOf(last.measured_at)}, a change of ${change >= 0 ? '+' : ''}${one(change)} kg. ` +
        'A week of readings moves with water, salt and the cycle as much as with fat, so do not call this fat lost or gained.'
    );
  }

  // THE CYCLE, because it changes how a week reads and is invisible on every
  // other tab. Day 1 is the first day of bleeding.
  if (input.lastPeriod) {
    const since = Math.floor((Date.parse(`${input.today}T12:00:00Z`) - Date.parse(`${input.lastPeriod}T12:00:00Z`)) / DAY);
    if (isFinite(since) && since >= 0 && since < 90) {
      lines.push(`Cycle: day ${since + 1}, counting from ${input.lastPeriod}.`);
    }
  }

  lines.push(
    'READ ACROSS THESE, NOT DOWN ONE. Each line on its own is a number they can already see on its own tab. What no tab can show is how they bear on each other: training up while sleep is down, a sedentary stretch that lines up with being unwell, where they are in the cycle against how a week has felt. Name what is genuinely notable and say what it interacts with. Two or three things at most - this is a reading, not a report.',
    'AND BE WILLING TO SAY THERE IS NOTHING TO SAY. Two logged days is not a week. A pattern found in three points is noise with a story attached, and one of those costs more trust than staying quiet ever would. Where the week is too thin, say so plainly and say what would make it readable.'
  );

  return lines.join('\n');
}
