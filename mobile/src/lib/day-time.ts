// WHEN IN THE DAY, READ BACK OUT OF WHAT SHE TYPED.
//
// Ruth, 1 October 2026, UI refinement items 3 and 4: activities should sit in
// chronological order within a day, and show their planned time - exact (19:30),
// approximate (~09:00), or nothing at all.
//
// `user_week.time_of_day` IS AND STAYS FREE TEXT. That was deliberate: "7pm",
// "evening", "after the school run" and "before work" are all answers she might
// give, and only one of them is a clock. Parsing on the way IN would have thrown
// the other three away. So the column keeps her words and this module derives two
// things from them on the way out:
//
//   minutes   a sort key, so the day has a rhythm
//   label     what the pill shows
//
// THE SORT KEY AND THE LABEL ARE NOT THE SAME THING, and keeping them separate is
// the whole trick. "Evening" sorts after "morning" - that is real information and
// it is what makes the week scannable - but it must DISPLAY as "evening", never
// as "~18:30". Inventing a clock she never said, and then showing it to her, is
// the app putting words in her mouth about her own diary. So a part of the day
// gets a nominal bucket used ONLY for ordering, and shows the word she wrote.
//
// THE CLOCK IS NORMALISED TO 24 HOURS, which is a change from her words and is
// her instruction: a column of "19:30" and "09:00" can be scanned down, and
// "7pm / 9.30am / 14:00" cannot. The database still holds what she typed and chat
// still speaks it back in her words - see the reply prompt. Only the pill
// reformats, because the pill is the thing being scanned.
//
// APPROXIMATE IS HER HEDGE, NOT OUR GUESS. "~" appears only when she hedged -
// "around 9", "9ish", "about 7pm". A plain "7pm" is shown as 19:00 with no
// tilde, because she stated it.

export type TimeKind =
  /** A clock time, hers or hedged. */
  | 'clock'
  /** Morning, evening, lunchtime: ordered, but shown as the word. */
  | 'partOfDay'
  /** "After the school run" - shown as written, ordered last. */
  | 'phrase'
  /** Nothing said. */
  | 'none';

export type PlannedTime = {
  kind: TimeKind;
  /** Minutes from midnight for SORTING ONLY. Null sorts last. */
  minutes: number | null;
  /** What the pill shows, or null for nothing. */
  label: string | null;
  /** True when she hedged the clock time. Decides the leading "~". */
  approximate: boolean;
};

export const NO_TIME: PlannedTime = {
  kind: 'none',
  minutes: null,
  label: null,
  approximate: false,
};

/**
 * NOMINAL, FOR ORDER ONLY. These numbers are never shown. They exist so that
 * "morning" lands before "evening", which is the rhythm she asked for, and they
 * are deliberately spread so a stated clock time interleaves sensibly: a 10:00
 * class comes after "morning" coffee and before an "evening" one.
 */
const PART_OF_DAY: { match: RegExp; minutes: number }[] = [
  { match: /\b(dawn|first thing|early morning)\b/, minutes: 6 * 60 },
  { match: /\b(before work|before the school run)\b/, minutes: 7 * 60 + 30 },
  { match: /\bmorning\b/, minutes: 9 * 60 },
  { match: /\b(midday|noon|lunchtime|lunch)\b/, minutes: 12 * 60 + 30 },
  { match: /\bafternoon\b/, minutes: 14 * 60 },
  { match: /\b(after work|after the school run|teatime)\b/, minutes: 17 * 60 + 30 },
  { match: /\b(evening|dusk)\b/, minutes: 18 * 60 + 30 },
  { match: /\b(night|tonight|bedtime|last thing)\b/, minutes: 21 * 60 },
];

/** Words that make a stated time an approximation. */
const HEDGE = /(~|\babout\b|\baround\b|\broughly\b|\bapprox\w*\b|\bcirca\b|\bsometime\b|ish\b)/;

/**
 * A clock, in the shapes somebody actually types.
 *
 * DELIBERATELY NOT CLEVER. It wants an hour, optional minutes after : . or h,
 * and an optional am/pm. "7pm", "7:30pm", "19:30", "9.30am", "7 pm", "19h30".
 * A bare "9" is NOT a time: "gym 9" could be nine reps, nine o'clock or a
 * machine number, and guessing wrong puts a wrong time on her week. Hedged bare
 * numbers are the one exception, because "around 9" can only be a time.
 */
//
// NOTE THE LOOKAHEAD RATHER THAN A TRAILING \b. A word boundary needs a
// transition, and "9ish" has none between the 9 and the i - both are word
// characters. So a trailing \b made this miss every hedge written that way,
// which is the most natural way to write one. (?!\d) says "the number ends
// here" without requiring a letter to count as a separator.
const CLOCK = /\b(\d{1,2})\s*(?:[:.h]\s*(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?(?!\d)/;
const BARE_HOUR_WHEN_HEDGED = /\b(\d{1,2})(?!\d)/;

function two(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** HH:MM from minutes-past-midnight. */
export function clockLabel(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${two(Math.floor(m / 60))}:${two(m % 60)}`;
}

/**
 * Read a planned time out of her own words.
 *
 * Order matters: a clock beats a part of the day, so "thursday evening at 7pm"
 * shows 19:00 rather than "evening". She gave both; the more specific one is the
 * one she would want to see.
 */
export function plannedTime(text: string | null | undefined): PlannedTime {
  if (typeof text !== 'string') return NO_TIME;
  const raw = text.trim();
  if (!raw) return NO_TIME;
  const lower = raw.toLowerCase();
  const hedged = HEDGE.test(lower);

  // ---- a clock ----------------------------------------------------------
  const m = CLOCK.exec(lower);
  // A bare number with no am/pm and no minutes is only a time when she hedged.
  const bare = m !== null && m[2] === undefined && m[3] === undefined;
  const usable = m !== null && (!bare || hedged);
  if (usable && m) {
    let hour = Number(m[1]);
    const mins = m[2] === undefined ? 0 : Number(m[2]);
    const suffix = m[3] ? m[3].replace(/\./g, '') : null;
    if (hour > 24 || mins > 59) return phraseOrPart(raw, lower);
    if (suffix === 'pm' && hour < 12) hour += 12;
    if (suffix === 'am' && hour === 12) hour = 0;
    if (hour === 24) hour = 0;
    // NO AM/PM AND NO 24-HOUR READING is ambiguous, and the ambiguity is not
    // resolvable from the text. A bare hedged "around 9" is read as 9am for
    // mornings and left alone otherwise - which is still a guess, so it is
    // marked approximate and carries the tilde that says so.
    if (hour > 23) return phraseOrPart(raw, lower);
    return {
      kind: 'clock',
      minutes: hour * 60 + mins,
      label: `${hedged ? '~' : ''}${clockLabel(hour * 60 + mins)}`,
      approximate: hedged,
    };
  }

  if (hedged) {
    const b = BARE_HOUR_WHEN_HEDGED.exec(lower);
    if (b) {
      const hour = Number(b[1]);
      if (hour <= 23) {
        return {
          kind: 'clock',
          minutes: hour * 60,
          label: `~${clockLabel(hour * 60)}`,
          approximate: true,
        };
      }
    }
  }

  return phraseOrPart(raw, lower);
}

/** A part of the day if it names one, otherwise her phrase as written. */
function phraseOrPart(raw: string, lower: string): PlannedTime {
  for (const { match, minutes } of PART_OF_DAY) {
    if (match.test(lower)) {
      // HER WORD, NOT THE BUCKET. The number is only for the sort.
      return { kind: 'partOfDay', minutes, label: raw, approximate: false };
    }
  }
  return { kind: 'phrase', minutes: null, label: raw, approximate: false };
}

/**
 * The second line of a pill: the time and how long, whichever exist.
 *
 * "~09:00 · 60 mins", or just one of them, or nothing. Returning '' rather than
 * null for nothing keeps the caller's test a plain truthiness check.
 */
export function pillDetail(timeOfDay: string | null, duration: string | null): string {
  const t = plannedTime(timeOfDay);
  return [t.label, duration].filter((s): s is string => Boolean(s && s.trim())).join(' · ');
}

/**
 * Chronological within a day, as item 3 asks.
 *
 * STABLE, AND FALLS BACK TO HER ORDER. Two things at the same time - or two with
 * no time at all - keep the order she arranged them in, which is sort_order and
 * then creation. A sort that reshuffles equal items on every render makes a page
 * feel broken in a way nobody can describe.
 *
 * ANYTHING WITHOUT A TIME SORTS LAST, not first. A day reads "09:00 gym, 19:00
 * French, and also yoga at some point", and that is the right way round: the
 * things with a time are the spine of the day.
 */
export function byTimeOfDay<T extends { time_of_day?: string | null }>(rows: T[]): T[] {
  return rows
    .map((row, i) => ({ row, i, at: plannedTime(row.time_of_day ?? null).minutes }))
    .sort((a, b) => {
      if (a.at === b.at) return a.i - b.i;
      if (a.at === null) return 1;
      if (b.at === null) return -1;
      return a.at - b.at;
    })
    .map((x) => x.row);
}
