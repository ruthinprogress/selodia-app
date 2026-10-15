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
      // A DAY NUMBER PAST ABOUT FORTY IS A MISSING LOG, NOT A LONG CYCLE, and
      // saying so is the block's job rather than the model's. Found on the
      // first live test, 14 October 2026: the block handed over "day 52" flatly
      // and the reply worked out for itself that it meant an unlogged period.
      // It was right, and relying on that is relying on the model to catch a
      // figure this file presented as fact - which is the one thing a computed
      // block must never need.
      const day = since + 1;
      lines.push(
        `Cycle: day ${day}, counting from ${input.lastPeriod}.` +
          (day > 40
            ? ' THAT IS ALMOST CERTAINLY A PERIOD THEY HAVE NOT LOGGED rather than a cycle that long, so do not use this day number for anything. Say the last one on record is old and that it can be added from the Cycle page on the Log tab.'
            : '')
      );
    }
  }

  // AGAINST HER OWN USUAL, WHICH IS THE PART THAT WAS MISSING.
  //
  // Ruth, 15 October 2026, writing the sentence she wanted: "bit of a drop in
  // activity and increase in average intake of carbs and energy in general -
  // looks like there might be something going on in your life - would you like
  // to talk about it?"
  //
  // That sentence could not be written, because everything above is a single
  // seven-day window. It can say what this week was; it has nothing to say "a
  // DROP" against. So on the day her movement log went quiet - three days
  // during a fever - the model had a sparse week, no baseline, and no reason
  // for it, and filled the silence by inventing a hard session she had not
  // done. Four times.
  //
  // A comparison the model has to do in its head is a comparison it will get
  // wrong or invent, which is the rule this whole file exists for. So the
  // previous four weeks are worked out here too, and the change is handed over
  // as a figure.
  const silence = unusualSilence(input);
  const against = [...(silence ? [silence] : []), ...changesAgainstUsual(input)];
  if (against.length > 0) {
    lines.push(
      `AGAINST THEIR OWN USUAL (this week vs the four weeks before it): ${against.join('; ')}.`
    );
  }

  lines.push(
    // WHAT TO DO WITH A CHANGE NOBODY HAS EXPLAINED, and it replaces inventing
    // one. Her words for the shape of it: "it might have been nice for it to
    // ask in some way that was non guilt making."
    //
    // TWO THINGS MAKE IT NON-GUILT-MAKING, and they are both in her sentence.
    // It reads ACROSS domains, so it is an observation about a week rather than
    // about her discipline - a drop in training beside a rise in intake is a
    // life event, and a drop in training on its own is a telling-off. And it
    // puts the cause in her life rather than in her character: "looks like
    // there might be something going on" is a door, "you have been less active"
    // is a verdict.
    // AND LOOK BEFORE DECIDING NOTHING EXPLAINS IT (Ruth, 15 October 2026).
    //
    // "the knee injury wasn't mentioned either." Her movement log stopped on
    // 12 October. Her care record for 12 October holds a GP referral to
    // physiotherapy for recurrent left knee symptoms, and the 14th holds the
    // insurance claim and the consultant appointment that followed it. The
    // reason the training stopped was sitting two blocks away in the same
    // prompt, dated the same day, and the reply invented a hard session
    // instead.
    //
    // Her instruction, and it is the whole of this file in one line: "I just
    // want it to infer from all the logged data or lack of it."
    //
    // So the quiet stretch is checked against the rest of the record BEFORE it
    // counts as unexplained. An injury under referral, an illness they
    // mentioned, a letter read this week - those are the answer far more often
    // than anything the model would reach for.
    'LOOK FOR THE REASON IN THE REST OF THEIR RECORD BEFORE YOU DECIDE THERE IS NOT ONE. A movement log that stops is usually explained somewhere else in this prompt and dated within a day or two of it: an injury, a referral, a letter, an appointment, an illness they told you about, a stretch of bad nights. Say that connection plainly when it is there - "nothing logged since the 12th, which is the day the knee referral went in" - because that is the sentence that shows you are holding their whole record, and it is the one thing no screen in the app can do. Only when you have looked and genuinely found nothing does the question below apply.',
    'WHEN SOMETHING HAS MOVED AND NOTHING IN THE RECORD EXPLAINS IT, ASK - NEVER SUPPLY A REASON. A quiet stretch of training, a week of higher intake, a run of poor nights: these have causes, and the causes are in their life, not in this record. You may NOT write the reason yourself, and that includes the plausible ones - a hard session, a busy week, a holiday. Name what moved, across more than one domain where you can, put the cause in their life rather than in them, and offer the conversation: "quieter than usual on movement this week and intake up a bit - anything going on, or just how the week went?" Then stop. No plan, no encouragement to get back to it, and never a word implying they let something slip.',
    'READ ACROSS THESE, NOT DOWN ONE. Each line on its own is a number they can already see on its own tab. What no tab can show is how they bear on each other: training up while sleep is down, a sedentary stretch that lines up with being unwell, where they are in the cycle against how a week has felt. Name what is genuinely notable and say what it interacts with. Two or three things at most - this is a reading, not a report.',
    'AND BE WILLING TO SAY THERE IS NOTHING TO SAY. Two logged days is not a week. A pattern found in three points is noise with a story attached, and one of those costs more trust than staying quiet ever would. Where the week is too thin, say so plainly and say what would make it readable.'
  );

  return lines.join('\n');
}

/** How many days before the current window the baseline covers. */
const BASELINE_DAYS = 28;

/** The per-day figures a stretch of days comes to. */
type Usual = {
  days: string[];
  kcalPerDay: number | null;
  sessionsPerWeek: number | null;
  movingMinutesPerWeek: number | null;
  stepsPerDay: number | null;
};

function summarise(input: WeekInput, days: string[]): Usual {
  const has = new Set(days);
  const inIt = (iso: string | null): boolean => !!iso && has.has(dayOf(iso));

  // PER DAY SHE LOGGED, not per day in the window, which is the same rule the
  // block above uses. Four weeks containing three logged days would otherwise
  // read as a collapse in eating rather than a gap in logging.
  const kcalByDay = new Map<string, number>();
  for (const f of input.food) {
    if (!inIt(f.happened_at)) continue;
    const k = num(f.kcal);
    if (k != null) kcalByDay.set(dayOf(f.happened_at), (kcalByDay.get(dayOf(f.happened_at)) ?? 0) + k);
  }

  const sessions = input.activity.filter((a) => inIt(a.happened_at));
  const minutes = sessions.reduce((s, a) => s + (num(a.duration_min) ?? 0), 0);
  const steps = input.dailyBurn.filter((b) => has.has(dayOf(b.date))).map((b) => num(b.steps)).filter((s): s is number => s != null);

  const weeks = days.length / 7;
  return {
    days,
    kcalPerDay: mean([...kcalByDay.values()]),
    sessionsPerWeek: weeks > 0 ? sessions.length / weeks : null,
    movingMinutesPerWeek: weeks > 0 ? minutes / weeks : null,
    stepsPerDay: mean(steps),
  };
}

/** The days of the baseline: the four weeks ENDING where this week begins. */
function baselineDays(today: string): string[] {
  const end = Date.parse(`${today}T12:00:00Z`);
  if (!isFinite(end)) return [];
  return Array.from({ length: BASELINE_DAYS }, (_, i) =>
    new Date(end - (BASELINE_DAYS + WINDOW - 1 - i) * DAY).toISOString().slice(0, 10)
  );
}

/**
 * What has genuinely moved this week against her own four-week usual.
 *
 * SILENT UNLESS IT IS WORTH SAYING, on two counts. A change under a fifth is
 * ordinary variation and naming it would make every week look eventful, which
 * is its own kind of pressure. And a baseline built on one or two logged days
 * is not a baseline - a comparison against it says more about her logging than
 * about her week, and that is the sentence most likely to land as a telling-off
 * for nothing.
 */
export function changesAgainstUsual(input: WeekInput): string[] {
  const now = summarise(input, windowDays(input.today));
  const before = summarise(input, baselineDays(input.today));
  const out: string[] = [];

  const moved = (then: number | null, nowValue: number | null): number | null => {
    if (then == null || nowValue == null || then <= 0) return null;
    const change = (nowValue - then) / then;
    return Math.abs(change) >= 0.2 ? change : null;
  };
  const say = (change: number): string => `${change > 0 ? 'up' : 'down'} ${Math.round(Math.abs(change) * 100)}%`;

  const sessions = moved(before.sessionsPerWeek, now.sessionsPerWeek);
  if (sessions != null) {
    out.push(
      `sessions logged ${say(sessions)} (${(now.sessionsPerWeek ?? 0).toFixed(1)} this week against ${(before.sessionsPerWeek ?? 0).toFixed(1)} a week usually)`
    );
  }

  const minutes = moved(before.movingMinutesPerWeek, now.movingMinutesPerWeek);
  if (minutes != null && sessions == null) {
    out.push(`time spent moving ${say(minutes)} on their usual week`);
  }

  const steps = moved(before.stepsPerDay, now.stepsPerDay);
  if (steps != null) {
    out.push(`steps ${say(steps)} (${Math.round(now.stepsPerDay ?? 0)} a day against ${Math.round(before.stepsPerDay ?? 0)})`);
  }

  // INTAKE LAST AND ONLY ALONGSIDE SOMETHING ELSE, deliberately. "You have
  // eaten more than usual" on its own is the sentence this app exists without.
  // Beside a drop in movement it is an observation about a week; by itself it
  // is a comment on her eating, and she has been clear this is not a weight
  // loss app.
  const kcal = moved(before.kcalPerDay, now.kcalPerDay);
  if (kcal != null && out.length > 0) {
    out.push(`intake ${say(kcal)} (${Math.round(now.kcalPerDay ?? 0)} kcal a day against ${Math.round(before.kcalPerDay ?? 0)})`);
  }

  return out;
}

/**
 * How many days since anything was logged in a domain, and whether that is
 * unusual for them.
 *
 * THE WEEKLY AVERAGE HID THE THING SHE NOTICED. Measured on her own record for
 * 15 October: sessions came out UP 23% on her usual, because the seven days
 * ending that day contained a busy 9th to 12th and then three days of silence.
 * What she saw was not a quieter week - it was "I've not logged any activity as
 * normal", which is a RUN of empty days against a habit, and no average can
 * show it.
 *
 * So the gap is counted directly, and it is only worth saying when it is longer
 * than the gaps they usually leave - somebody who logs twice a week has not
 * stopped doing anything after two quiet days.
 */
export function unusualSilence(input: WeekInput): string | null {
  const today = Date.parse(`${input.today}T12:00:00Z`);
  if (!isFinite(today)) return null;

  const logged = new Set(
    input.activity
      .map((a) => dayOf(a.happened_at))
      .filter((d) => Date.parse(`${d}T12:00:00Z`) <= today)
  );
  if (logged.size < 4) return null; // Not enough of a habit to have broken one.

  // The run of days ending today with nothing logged.
  let gap = 0;
  for (let i = 0; i < 21; i += 1) {
    const day = new Date(today - i * DAY).toISOString().slice(0, 10);
    if (logged.has(day)) break;
    gap += 1;
  }
  if (gap === 0) return null;

  // What their gaps usually look like: the mean days between logged sessions
  // over the five weeks behind them.
  const days = [...logged].sort();
  const spans: number[] = [];
  for (let i = 1; i < days.length; i += 1) {
    const span = Math.round((Date.parse(`${days[i]}T12:00:00Z`) - Date.parse(`${days[i - 1]}T12:00:00Z`)) / DAY);
    if (span > 0 && span < 21) spans.push(span);
  }
  // THE MIDDLE GAP, NOT THE AVERAGE ONE, and this was measured wrong first.
  //
  // On her own record the mean span came out high enough to suppress the
  // sentence entirely: she had logged every day for a week before stopping,
  // but a couple of long gaps earlier in the five weeks dragged the average up
  // past the three silent days. The average described a history she had
  // already moved on from. The median describes the habit she actually has.
  const sorted = [...spans].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const usual = sorted[Math.floor(sorted.length / 2)];

  // Longer than usual AND long enough to be worth a sentence. Both, because
  // somebody who logs daily has not stopped after one rest day, and somebody
  // who logs twice a week has not stopped after three.
  if (gap < 3 || gap < usual * 2) return null;

  return `nothing logged for movement in ${gap} days, where they usually leave ${usual} day${usual === 1 ? '' : 's'}`;
}
