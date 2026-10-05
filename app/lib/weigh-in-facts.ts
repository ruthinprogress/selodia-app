// WHAT THE APP KNOWS ABOUT A WEIGH-IN, COMPUTED RATHER THAN INFERRED.
//
// Ruth, 27 September 2026, and it is the most serious kind of bug this app can
// have: "After today's weigh-in (Sun 27 Sept, 56.9 kg), the chat explained the
// rise with 'you had a hard session a day or two ago'. Nothing like that is
// logged... This is the most serious kind of bug for Selodía: the app is only
// useful if people can trust that what it says about their body comes from
// their own record."
//
// TWO SEPARATE FAULTS IN ONE REPLY, and they have different causes.
//
// 1. IT INVENTED AN EVENT. The model was given seven days of activity as prose
//    and asked to be helpful about a rise. Nothing told it that the ABSENCE of
//    a hard session was itself a fact, so it reached for the likeliest
//    explanation and stated it as something she had done. A list somebody has
//    to notice is empty is not the same as being told it is empty.
//
// 2. IT DID ITS OWN ARITHMETIC. "Up 1.4 kg since your reading 2 days ago",
//    where the screen said +1.3 and the reading was three days earlier. The
//    cause of the 1.3/1.4 split is worth writing down: 56.9 - 55.6 is 1.3, but
//    the STORED values differ by about 1.36, so rounding the difference gives
//    1.4 while rounding each figure first gives 1.3. The screen rounds each
//    figure, because those are the only numbers she can see - so round-then-
//    subtract is the correct rule, not the convenient one. A number she cannot
//    reproduce by looking at her own screen is wrong even when the arithmetic
//    is right.
//
// So this computes the change, the gap in days, what was actually logged in the
// three days before, and what the food log says about salt - and hands all of
// it over as facts. The model is told to use these and never to calculate.
//
// ---------------------------------------------------------------------------
// AND A THIRD FAULT, 5 October 2026. Ruth: "Bug - scales log from Saturday but
// talk about 'tomorrow' - makes no sense."
//
// Her newest reading was two days old and this block assumed every reading was
// today's: `const reading = { measured_at: nowIso }`. So the three days of
// movement it listed were the three days before TODAY rather than the three
// before the reading, the salt line described a day the reading knows nothing
// about, and nothing anywhere said the reading was not from today. The model
// filled that in the only way it could, and talked about where tomorrow would
// land.
//
// THE READING'S OWN DAY IS THE ANCHOR NOW, for every window in here, and the
// block says out loud when that day is not today. A date the model is not given
// is a date the model will infer. This is the same shape as the two faults
// above: not a wrong calculation, a missing fact.

type Measurement = {
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
};

type Activity = {
  happened_at: string;
  activity_type: string | null;
  duration_min: number | null;
  intensity: string | null;
};

type Food = { happened_at: string; sodium_mg?: number | null };

/** As the screen shows it. Round each figure, THEN subtract. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Whole calendar days between two moments, which is how a person counts. */
function daysBetween(earlier: string, later: string): number {
  const a = Date.parse(dayKey(earlier) + 'T00:00:00Z');
  const b = Date.parse(dayKey(later) + 'T00:00:00Z');
  return Math.round((b - a) / 86_400_000);
}

function saidAsDays(n: number): string {
  if (n === 0) return 'the same day';
  if (n === 1) return 'yesterday';
  return `${n} days earlier`;
}

/**
 * The block for the turn prompt, or null when there is nothing to anchor on.
 *
 * ANCHORED ON THE LAST STORED WEIGH-IN, NOT THE ONE BEING LOGGED, because of
 * where in the turn this runs: the model composes its reply BEFORE the message
 * is parsed and saved, so a weight she has just typed does not exist as a row
 * yet. What can be stated with certainty is what her record already holds - the
 * previous reading, its exact date, and how many days ago that was - and those
 * are precisely the anchors both errors came from. "2 days ago" was wrong
 * because nothing told it the date; the arithmetic was wrong because nothing
 * told it how to round.
 */
export function weighInFacts(
  recentMeasurements: Measurement[],
  recentActivity: Activity[],
  recentFood: Food[],
  today: Date = new Date()
): string | null {
  const nowIso = today.toISOString();
  const lines: string[] = [];

  const last = recentMeasurements
    .filter((m) => m.weight_kg != null)
    .sort((a, b) => b.measured_at.localeCompare(a.measured_at))[0];

  /**
   * THE DAY THE NEWEST READING BELONGS TO, which every window below is measured
   * from. Today, only when there is no reading at all.
   *
   * A CATCH-UP IS ORDINARY. Somebody photographing Saturday's scale on Monday is
   * doing a normal thing, and measured-when.ts deliberately keeps that date
   * rather than correcting it. What was missing was anybody telling the model.
   */
  const anchorIso = last?.measured_at ?? nowIso;
  const anchorIsToday = dayKey(anchorIso) === dayKey(nowIso);

  if (last?.weight_kg != null) {
    const was = round1(last.weight_kg);
    const gap = daysBetween(last.measured_at, nowIso);
    lines.push(
      `HER LAST WEIGH-IN ON RECORD: ${was} kg, on ${dayKey(last.measured_at)}, which was ${saidAsDays(gap)}. That date is a fact - never say "a couple of days ago" or guess an interval, say what this line says.`
    );
    if (!anchorIsToday) {
      lines.push(
        `THAT READING IS NOT FROM TODAY. Today is ${dayKey(nowIso)} and her newest reading is from ${dayKey(last.measured_at)}, ${saidAsDays(gap)}. Everything below describes the day of the reading, not today. So do not say "today", "this morning" or "tomorrow" as though the reading had just been taken: there is no reading for today, and "worth seeing where tomorrow lands" is about a day she has not weighed herself on. If a next reading is worth mentioning at all, say "your next weigh-in" rather than naming a day.`
      );
    }
    lines.push(
      `IF SHE HAS JUST GIVEN YOU A NEW WEIGHT, compare it against ${was} kg and against that date. ROUND EACH FIGURE TO ONE DECIMAL PLACE AND THEN SUBTRACT, which is what the screen does - rounding the difference instead gives a number she cannot reproduce by looking at her own readings, and a figure she cannot check is wrong even when the arithmetic is right. Give one figure, not two.`
    );
  } else {
    lines.push(
      'HER LAST WEIGH-IN ON RECORD: there is not one. So if she gives you a weight, do not describe it as a rise, a fall or a change of any kind - there is nothing to change from.'
    );
  }

  // THE WINDOWS BELOW ARE THE READING'S, NOT TODAY'S. This was `nowIso`, which
  // is the whole of the 5 October fault: for a reading two days old it listed
  // the wrong three days of movement and then called a day she had not weighed
  // on "today".
  const reading = { measured_at: anchorIso } as Measurement;

  /** Named once, so the movement block and the salt block cannot disagree. */
  const window = anchorIsToday
    ? 'IN THE LAST THREE DAYS'
    : `IN THE THREE DAYS UP TO ${dayKey(anchorIso)}, THE DAY OF THE READING`;
  const saltDay = anchorIsToday
    ? 'SALT TODAY'
    : `SALT ON ${dayKey(anchorIso)}, THE DAY OF THE READING`;

  // WHAT SHE ACTUALLY DID. Stated as a fact either way, because an empty list
  // is only informative if somebody says it is empty.
  const since = Date.parse(dayKey(reading.measured_at) + 'T00:00:00Z') - 3 * 86_400_000;
  const recent = recentActivity
    .filter((a) => Date.parse(dayKey(a.happened_at) + 'T00:00:00Z') >= since)
    .filter((a) => Date.parse(a.happened_at) <= Date.parse(reading.measured_at));

  if (recent.length === 0) {
    lines.push(
      `MOVEMENT ${window}: NOTHING AT ALL IS LOGGED. So you may not say she trained, exercised, had a hard session, did a heavy workout, or anything of that shape. Not as a statement, not as a reminder, not as "after yesterday's session". There was no session in the record.`
    );
  } else {
    const said = recent
      .sort((a, b) => a.happened_at.localeCompare(b.happened_at))
      .map(
        (a) =>
          `  ${dayKey(a.happened_at)}: ${a.activity_type ?? 'something'}${a.duration_min != null ? `, ${a.duration_min} min` : ''}${a.intensity ? `, ${a.intensity}` : ''}`
      );
    lines.push(
      `MOVEMENT ${window}, in full. This is everything. If it is two minutes of pushups, then two minutes of pushups is what happened, and it does not explain a kilogram:`
    );
    lines.push(...said);
  }

  // SALT, ONLY IF THE LOG SAYS SO. Hydration and salt genuinely move the scale
  // day to day, which is why it is tempting - and why it has to be checked
  // rather than offered as a likely story.
  const dayFood = recentFood.filter((f) => dayKey(f.happened_at) === dayKey(reading.measured_at));
  const sodium = dayFood.reduce((n, f) => n + (f.sodium_mg ?? 0), 0);
  const known = dayFood.some((f) => f.sodium_mg != null);
  if (!known || dayFood.length === 0) {
    lines.push(
      `${saltDay}: not known, because nothing was logged with a sodium figure. So do not suggest a salty day as the reason. You may say in general terms that salt and hydration move the scale, as long as it is plainly a general possibility and not something she did.`
    );
  } else {
    lines.push(
      `${saltDay}: about ${Math.round(sodium)} mg of sodium across what she logged. Mention it only if it is genuinely high for her, and say it as one possibility among several rather than as the cause.`
    );
  }

  lines.push(
    'THE RULE BEHIND ALL OF THIS. You may only name a meal, a session, an event or a day as SOMETHING SHE DID when it is in the record above with that date. Anything else is a general possibility and has to sound like one - "a salty day or a hard session can do this" is fine, "you had a hard session a day or two ago" is not, and the difference is whether you are describing her life or describing bodies in general. A single invented event undoes the reason this app exists.'
  );

  return lines.join('\n');
}
