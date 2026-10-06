// WHAT IS ACTUALLY IN HER WEEK, PUT IN FRONT OF THE MODEL.
//
// Ruth, 1 October 2026: a new thing in her week should be "readable throughout
// the app, including chat".
//
// It was not readable by chat at all. turn_context - the one query that builds
// everything the model is told - did not select user_week, so Selodía has never
// been able to say what is in her week. As of an hour ago it could WRITE to it
// and still could not read it, which is the worst of both: it can add a French
// class and then not be able to tell her it is there.
//
// FOURTH INSTANCE THIS WEEK of collected, stored, read by nobody - after the Me
// cards, life_stage and hrt, and the calcium column in the CoFID import. The
// rule that came out of it is a commit-level one: whatever starts being stored
// gets read in the same commit, or it does not go in.
//
// FACTS, NOT INSTRUCTIONS. Same discipline as life-stage-facts.ts and
// meFactsBlock: this says what is there. What the model may DO about it belongs
// in the prompt, because a field name in front of the writer comes out as JSON
// in her message.

type WeekRow = {
  activity?: string | null;
  days?: unknown;
  duration?: string | null;
  cadence?: string | null;
  time_of_day?: string | null;
  purpose?: string | null;
};

const DAY_WORD: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

function daysOf(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((d): d is string => typeof d === 'string') : [];
}

/**
 * The block, or '' when her week is empty.
 *
 * ANYTIME IS SAID OUT LOUD rather than left blank. A row with no days is a real
 * answer - walking, skipping, whatever she does when she can - and a line that
 * only names the activity reads like a row the app failed to finish.
 */
export function weekFacts(rows: unknown): string {
  const list = Array.isArray(rows) ? (rows as WeekRow[]) : [];
  const usable = list.filter((r) => typeof r.activity === 'string' && r.activity.trim());
  if (usable.length === 0) return '';

  const lines = usable.map((r) => {
    const days = daysOf(r.days);
    const when =
      days.length > 0 ? days.map((d) => DAY_WORD[d] ?? d).join(', ') : 'Anytime this week';
    const bits = [when];
    if (r.time_of_day) bits.push(String(r.time_of_day));
    if (r.duration) bits.push(String(r.duration));
    else if (r.cadence) bits.push(String(r.cadence));
    const why = r.purpose ? ` - ${r.purpose}` : '';
    return `- ${r.activity}: ${bits.join(', ')}${why}`;
  });

  return [
    '',
    'WHAT IS IN THEIR WEEK, on the Plans tab. This is their own week, not a plan you made:',
    ...lines,
    // NOT EVERYTHING HERE IS EXERCISE, and reading it as if it were produces
    // nonsense. Ruth's own example: a French class is in her week precisely
    // because it takes an evening that movement could otherwise have had.
    'Some of these are not exercise. Something can be in their week because it OCCUPIES time rather than because it is training - a class, a commitment, a standing arrangement - and that is worth knowing when you talk about where something else could fit.',
    '',
  ].join('\n');
}
