// THE WORDS AROUND HER OWN DAYS.
//
// "run a report on all days i drank cocktails and my mood the following days"
//
// Every number in the table arrives from the server already computed - see
// app/lib/pattern-check.ts, where the arithmetic and the refusal to conclude
// both live. This file only turns those figures into labels, and it is kept
// separate from the component so the labels can be probed: a column headed
// "Next day" that is actually showing two days later would be a quiet lie in
// the one place somebody is looking hard.
//
// THE WORD FOR A RATING IS PASSED IN rather than imported, so this file has no
// dependencies and a probe can run it from the repo root. daily-ratings.ts owns
// the five words; nothing here has an opinion about them.

export type PatternPayload = {
  trigger: string;
  measure: string;
  offsets: number[];
  windowDays: number;
  matches: { day: string; what: string }[];
  rows: { day: string; after: (number | null)[] }[];
  cover: { have: number; of: number };
  comparison: { onThose: number | null; otherwise: number | null; fromThose: number; fromOthers: number };
  verdict: { standing: string; worthReading: boolean };
};

/** "Same day", "Next day", "2 days after". */
export function offsetLabel(offset: number): string {
  if (offset === 0) return 'Same day';
  if (offset === 1) return 'Next day';
  return `${offset} days after`;
}

/** "Cocktail, and mood the next day" - what the table says it is. */
export function patternHeading(trigger: string, measure: string, offsets: number[]): string {
  const thing = trigger.trim();
  const named = thing.charAt(0).toUpperCase() + thing.slice(1);
  const when =
    offsets.length === 1
      ? offsets[0] === 0
        ? 'the same day'
        : offsets[0] === 1
          ? 'the next day'
          : `${offsets[0]} days after`
      : 'the days after';
  return `${named}, and ${measure} ${when}`;
}

/** "Tue 15 Sep" - short, because the column is narrow and the year is never in doubt. */
export function dayLabel(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  return isNaN(d.getTime())
    ? day
    : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export type WordFor = (measure: string, value: number) => string | null;

/** The word for a rating, or an em dash for a day nobody rated. */
export function cell(measure: string, value: number | null, word: WordFor): string {
  return value == null ? '—' : (word(measure, value) ?? '—');
}

/**
 * The two averages in words, or null when there is nothing honest to put there.
 *
 * A MEAN OF FIVE ORDERED WORDS IS NOT A MEASUREMENT, so it is shown as the
 * nearest word with the figure beside it rather than as a decimal on its own.
 * "Flat (2.1)" is readable; "2.1" invites the reading that somebody's fortnight
 * has been measured to a tenth.
 */
export function averageLabel(measure: string, value: number | null, word: WordFor): string | null {
  if (value == null) return null;
  const nearest = word(measure, Math.round(value));
  return nearest ? `${nearest} (${value.toFixed(1)})` : value.toFixed(1);
}

/**
 * The line under the table.
 *
 * BOTH SIDES OR NEITHER. One average with nothing to compare it against is a
 * number floating free, and a person reading it will supply the comparison
 * themselves out of whatever they already suspected.
 */
export function comparisonLine(payload: PatternPayload, word: WordFor): string | null {
  const { comparison: c, measure } = payload;
  const those = averageLabel(measure, c.onThose, word);
  const other = averageLabel(measure, c.otherwise, word);
  if (!those || !other) return null;
  const named = measure === 'energy' ? 'Energy' : 'Mood';
  return `${named} on those days: ${those}, from ${c.fromThose} rated ${c.fromThose === 1 ? 'day' : 'days'}. Every other rated day: ${other}, from ${c.fromOthers}.`;
}

/** "Looked back over the last 120 days." - what was searched, always said. */
export function windowLine(payload: PatternPayload): string {
  return `Looked back over the last ${payload.windowDays} days, for "${payload.trigger}" in what you logged.`;
}
