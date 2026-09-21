// LOGGING A CYCLE OR A FEELING BY SAYING SO (21 September 2026).
//
// Ruth, on the Cycle page: "the chat should be able to fill it in directly from
// just speaking." And on mood, the reason it matters: "just voice logging meant
// that users had no idea what was available" - so the screen exists to be
// discovered, and speech exists because once you know a thing is there, saying
// it is faster than finding it.
//
// THE DATE COMES FROM THE MODEL, as it does for food and activity, which
// already resolve "Monday", "yesterday" and "last Tuesday" into a real date.
// Writing a fourth relative-day parser to sit beside three that work would be
// three chances to disagree about what Tuesday means.
//
// WHAT THIS FILE DOES IS REFUSE THINGS. Everything crossing from a model into
// somebody's cycle history or their record of how a fortnight felt is read
// field by field here: an event that is not one of three, a date that is not a
// date or has not happened, a rating outside one to five. Her cycle history is
// arithmetic on those dates, so one bad date is a wrong prediction for months.

export const CYCLE_EVENTS = ['period_start', 'period_end', 'spotting'] as const;
export type CycleEventType = (typeof CYCLE_EVENTS)[number];

export function cycleEventType(v: unknown): CycleEventType | null {
  return typeof v === 'string' && (CYCLE_EVENTS as readonly string[]).includes(v)
    ? (v as CycleEventType)
    : null;
}

/**
 * A day the model resolved, or null.
 *
 * NOTHING IN THE FUTURE. A period cannot have started tomorrow, and a feeling
 * cannot have been felt on Friday when it is Tuesday - so a future date is a
 * misread of "next Tuesday" or a model error, and either way the safe reading
 * is that they meant today rather than a date in a diary.
 *
 * NOTHING BEYOND A YEAR BACK, because "Tuesday" resolved to 2025 is a mistake
 * nobody would spot until a cycle average went strange months later.
 */
export function spokenDay(v: unknown, today: string): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const when = Date.parse(`${v}T12:00:00Z`);
  const now = Date.parse(`${today}T12:00:00Z`);
  if (!Number.isFinite(when) || !Number.isFinite(now)) return null;
  if (when > now) return null;
  if (now - when > 366 * 86_400_000) return null;
  return v;
}

/** 1 to 5, or null. Anything else is a model inventing a scale. */
export function rating(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= 1 && r <= 5 ? r : null;
}

export type SpokenCycle = { type: CycleEventType; day: string };
export type SpokenFeeling = {
  /** The first day it covers. */
  day: string;
  /** The last day it covers. Equal to `day` for the ordinary single-day case. */
  through: string;
  mood: number | null;
  energy: number | null;
  note: string | null;
};

// A MONTH IS AS FAR AS ONE SENTENCE REACHES. "Shattered ever since" about a
// period three weeks ago is a real thing to say; "tired since January" is a
// feeling about a season, and writing two hundred and sixty identical rows from
// it would bury every day somebody actually logged.
export const LONGEST_SPAN_DAYS = 31;

/** Every day from one to the other, inclusive. Empty when the pair makes no sense. */
export function daysFrom(from: string, to: string): string[] {
  const start = Date.parse(`${from}T12:00:00Z`);
  const end = Date.parse(`${to}T12:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const span = Math.round((end - start) / 86_400_000) + 1;
  if (span > LONGEST_SPAN_DAYS) return [];
  const out: string[] = [];
  for (let i = 0; i < span; i += 1) {
    out.push(new Date(start + i * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * What the model said about a cycle, or nothing.
 *
 * ITS OWN DATE FIELD, NOT A SHARED ONE (corrected 21 September 2026, Ruth:
 * "What's going to differentiate feeling tired actually today, vs when logging
 * period start day"). She was right. One sentence can carry two facts on two
 * different days - "my period started Tuesday and I'm shattered today" - and a
 * single date passed round between them puts today's tiredness on Tuesday.
 */
export function readSpokenCycle(
  raw: { cycleEvent?: unknown; cycleDate?: unknown },
  today: string
): SpokenCycle | null {
  const type = cycleEventType(raw.cycleEvent);
  if (!type) return null;
  // A DAY NOBODY NAMED IS TODAY, which is what somebody saying "my period
  // started" without a day means.
  return { type, day: spokenDay(raw.cycleDate, today) ?? today };
}

/**
 * What the model said about how a day felt, or nothing.
 *
 * ITS OWN DATE, for the reason above: the day somebody FELT something and the
 * day their period started are two different days that often arrive in one
 * sentence.
 */
export function readSpokenFeeling(
  raw: {
    feelingMood?: unknown;
    feelingEnergy?: unknown;
    feelingDate?: unknown;
    feelingThrough?: unknown;
    feelingNote?: unknown;
  },
  today: string
): SpokenFeeling | null {
  const mood = rating(raw.feelingMood);
  const energy = rating(raw.feelingEnergy);
  // NEITHER MEASURE MEANS NOTHING TO RECORD. A note on its own is a sentence
  // about a day, which the conversation already keeps; it is not a rating, and
  // writing a row with no value would put a blank in every chart that reads
  // this table.
  if (mood == null && energy == null) return null;
  const note = typeof raw.feelingNote === 'string' && raw.feelingNote.trim()
    ? raw.feelingNote.trim().slice(0, 500)
    : null;
  const day = spokenDay(raw.feelingDate, today) ?? today;
  // "EVER SINCE" IS A RANGE (Ruth, 21 September 2026): "'been shattered ever
  // since' actually means that all days, including the period started day were
  // fatigued" - and then, on where it ends, "Upto Today."
  //
  // A span that runs backwards, or one longer than a month, is a misreading
  // rather than a fortnight, and collapses to the single day she named. Losing
  // six days is a gap; writing two hundred is a fabrication.
  const through = spokenDay(raw.feelingThrough, today);
  const ends = through && through >= day && daysFrom(day, through).length > 0 ? through : day;
  return { day, through: ends, mood, energy, note };
}

// AND IT SAYS WHERE TO GO AND LOOK (Ruth, 21 September 2026): "where do I
// check it landed? where is the history for Cycle to look back on? it's very
// confused." The confirmation is a pill that fades; somebody who logs a period
// by speaking has no way of knowing the Cycle page is where it went. Naming the
// screen costs four words and answers the question at the moment it is asked.
const WHERE = { cycle: 'Log › Cycle', feeling: 'Log › How you felt' };

/** What Selodía's confirmation says. Short, and names the day when it is not today. */
export function cycleSaved(event: SpokenCycle, today: string, human: (d: string) => string): string {
  const what =
    event.type === 'period_start' ? 'Period start' : event.type === 'period_end' ? 'Period end' : 'Spotting';
  const when = event.day === today ? 'today' : human(event.day);
  return `${what} recorded for ${when} · ${WHERE.cycle}`;
}

export function feelingSaved(
  f: SpokenFeeling,
  today: string,
  human: (d: string) => string,
  word: (measure: string, value: number) => string | null
): string {
  const parts: string[] = [];
  const m = f.mood != null ? word('mood', f.mood) : null;
  const e = f.energy != null ? word('energy', f.energy) : null;
  if (m) parts.push(`mood ${m.toLowerCase()}`);
  if (e) parts.push(`energy ${e.toLowerCase()}`);
  // A SPAN IS SAID BACK AS A SPAN, so a fortnight filled in from one sentence
  // is visible in the confirmation rather than discovered later in a chart.
  const first = f.day === today ? 'today' : human(f.day);
  const when =
    f.through === f.day ? first : `${first} to ${f.through === today ? 'today' : human(f.through)}`;
  return `Noted for ${when}: ${parts.join(', ')} · ${WHERE.feeling}`;
}

/**
 * A day named the way somebody would say it back: "Tuesday 15 September".
 *
 * NO YEAR, because everything this labels happened inside the last year and a
 * year on a confirmation reads like a records system rather than a reply. No
 * "yesterday" either - the caller has already decided whether the day is today,
 * and a confirmation that says a weekday is easier to check than one that makes
 * you count backwards.
 */
export function spokenDayLabel(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  return isNaN(d.getTime())
    ? day
    : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}
