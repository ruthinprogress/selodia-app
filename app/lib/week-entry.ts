import type { SupabaseClient } from '@supabase/supabase-js';

// ASKING IS THE YES, FOR HER WEEK TOO.
//
// Ruth, 1 October 2026: "I can also ask chat DIRECTLY to add french class on
// thursday night at 7pm."
//
// It was built as a confirm-first offer, through proposedSave, like a symptom or
// a Me card. A live probe against production put the error beyond argument. Two
// runs of the same sentence:
//
//   run 1  the model proposed, the offer was dropped by the one-offer-per-
//          conversation limit, and because the model had already asked the
//          question in its own words the next turn's "yes" was answered with
//          "French class, Thursday, 7pm - on your week now" over an empty table;
//   run 2  the model did not propose at all, and sent her to her Almanac.
//
// One attempt in two, and the failure mode is the app claiming to hold something
// it does not. But the limit and the variance are both symptoms. The cause is
// that "add french class on thursday at 7pm" IS NOT AN OFFER. It is an
// instruction, and routing an instruction through machinery built for things the
// app NOTICED gets the manners wrong before it gets the plumbing wrong: asking
// "want me to add that to your week?" after being told to add it to her week is
// the app requesting permission to do as it was told.
//
// THE PRECEDENT IS ALREADY HERE, TWICE, AND BOTH ARE HERS:
//
//   noteText   "There is no offer for a note, because asking is the yes."
//   meUpdate   "Do NOT offer first: telling you they have stopped something IS
//               the instruction."
//
// So a direct request is applied on the spot and the app states what it did.
// proposedSave type 'week' stays for the other case, which is real and
// different: something she MENTIONS in passing - "I've started a French class on
// Thursdays" while talking about something else - is the app noticing, and the
// app asks before writing to her week.
//
// THE APP STATES THE OUTCOME, NEVER THE MODEL. The reply was composed before any
// of this ran, so the model cannot honestly say the row exists. Same rule as
// every other write in the route.

export type WeekEntryRequest = {
  activity?: unknown;
  days?: unknown;
  time?: unknown;
  duration?: unknown;
};

export type WeekEntryOutcome =
  | { kind: 'added'; activity: string; days: string[]; time: string | null }
  | { kind: 'already'; activity: string }
  | { kind: 'failed' }
  | { kind: 'nothing' };

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

const DAY_WORD: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

function text(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

/** Day names as she might say them, down to the three letters the column holds. */
export function coerceDays(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out = v
    .filter((d): d is string => typeof d === 'string')
    .map((d) => d.trim().toLowerCase().slice(0, 3))
    .filter((d) => (DAYS as readonly string[]).includes(d));
  return [...new Set(out)];
}

/**
 * Put it in her week, now.
 *
 * ALREADY THERE IS NOT A FAILURE, and it is not a duplicate either. "Add French
 * class on Thursday" twice should leave one French class on Thursday, and should
 * say so plainly rather than silently making a second card - two identical cards
 * on one day is the kind of mess that makes somebody stop trusting a screen.
 *
 * A NAMED DAY ON AN EXISTING ACTIVITY IS ADDED TO IT, not written as a new row:
 * "gym on Thursday too" when Gym is already on Wednesday means one Gym on both
 * days, which is exactly what the Week screen's own "+" does.
 */
export async function addWeekEntry(
  supabase: SupabaseClient,
  userId: string,
  req: WeekEntryRequest
): Promise<WeekEntryOutcome> {
  const activity = text(req.activity);
  if (!activity) return { kind: 'nothing' };
  const days = coerceDays(req.days);
  const time = text(req.time);
  const duration = text(req.duration);

  const { data: existing, error: readError } = await supabase
    .from('user_week')
    .select('id, activity, days, time_of_day, sort_order')
    .eq('user_id', userId);
  if (readError) return { kind: 'failed' };

  const rows = Array.isArray(existing) ? existing : [];
  const match = rows.find(
    (r) => typeof r.activity === 'string' && r.activity.trim().toLowerCase() === activity.toLowerCase()
  );

  if (match) {
    const had: string[] = Array.isArray(match.days)
      ? (match.days as unknown[]).filter((d): d is string => typeof d === 'string')
      : [];
    const nextDays = [...new Set([...had, ...days])];
    const nextTime = time ?? (typeof match.time_of_day === 'string' ? match.time_of_day : null);
    const nothingNew =
      nextDays.length === had.length && nextTime === (match.time_of_day ?? null);
    if (nothingNew) return { kind: 'already', activity: String(match.activity) };
    const { error } = await supabase
      .from('user_week')
      .update({
        days: nextDays,
        // SHE NAMED THE DAY, so the stamp is hers. Without it the Week screen
        // hides the card under "Let me lead" and the add looks like it failed.
        days_chosen_at: nextDays.length > 0 ? new Date().toISOString() : null,
        time_of_day: nextTime,
      })
      .eq('id', match.id)
      .eq('user_id', userId);
    if (error) return { kind: 'failed' };
    return { kind: 'added', activity: String(match.activity), days: nextDays, time: nextTime };
  }

  // LAST IN HER WEEK. sort_order decides the Anytime order, and a new thing at
  // the top reshuffles a list she has been reading for a fortnight.
  const orders = rows
    .map((r) => (typeof r.sort_order === 'number' ? r.sort_order : null))
    .filter((n): n is number => n !== null);
  const nextOrder = orders.length > 0 ? Math.max(...orders) + 1 : 0;

  const { error } = await supabase.from('user_week').insert({
    user_id: userId,
    activity,
    days,
    days_chosen_at: days.length > 0 ? new Date().toISOString() : null,
    time_of_day: time,
    duration,
    // NO CADENCE AND NO PURPOSE FROM ONE SENTENCE. onboarding leaves purpose
    // null for the same reason: the why is what a conversation fills in, and
    // "1x/week" would be the app deciding how often she goes.
    cadence: null,
    purpose: null,
    sort_order: nextOrder,
  });
  if (error) return { kind: 'failed' };
  return { kind: 'added', activity, days, time };
}

/**
 * What she is told, written by the app because only the app knows it happened.
 *
 * IT NAMES THE DAY BACK TO HER. The cheapest check on a wrong day is seeing it
 * written down, and a wrong day is the likeliest thing to go wrong here.
 */
export function weekEntryNote(outcome: WeekEntryOutcome): string | null {
  if (outcome.kind === 'nothing') return null;
  if (outcome.kind === 'failed') {
    return "That didn't go into your week just now. Ask me again and I'll try once more.";
  }
  if (outcome.kind === 'already') {
    return `${outcome.activity} is already in your week, just as you said.`;
  }
  const when =
    outcome.days.length > 0
      ? outcome.days.map((d) => DAY_WORD[d] ?? d).join(' and ')
      : 'Anytime this week';
  const at = outcome.time ? ` at ${outcome.time}` : '';
  return `${outcome.activity} is in your week, ${when}${at}. It's on the Week view in Plans.`;
}

/**
 * Does the app still need to say it, or has the reply already?
 *
 * SAID TWICE IS A RECEIPT, which is the thing this app tries hardest not to be.
 * The real output, 1 October:
 *
 *   "French class, Thursday at 7pm - it's already there, on the Week view in
 *    Plans."
 *   "French class is in your week, Thursday at 7pm. It's on the Week view in
 *    Plans."
 *
 * Two voices saying one thing, the second redundant.
 *
 * AND IT IS STRUCTURALLY FORCED, not a prompt failure. The writer IS told that a
 * save which worked is not news and to just answer her - but on a turn whose
 * entire content is "add french class on thursday night at 7pm" there is nothing
 * else to answer, and no model returns an empty message. Telling it more firmly
 * would not change that.
 *
 * So the app yields when the model has already said it, which is exactly what
 * offerQuestion does with the offer line and for the same reason. The guarantee
 * runs the other way and is the one that matters: if the reply says nothing about
 * her week, the app always does.
 *
 * NARROW ON PURPOSE. It needs the activity AND a word placing it in her week or
 * her Plans. A reply that merely mentions French class while answering something
 * else has not told her the row exists, and suppressing the line there would
 * leave her with no confirmation at all - the failure this whole file is about.
 */
export function weekNoteNeeded(reply: string, outcome: WeekEntryOutcome): boolean {
  if (outcome.kind !== 'added' && outcome.kind !== 'already') return true;
  const said = typeof reply === 'string' ? reply : '';
  const activity = outcome.activity.trim();
  if (!activity) return true;
  const namesIt = said.toLowerCase().includes(activity.toLowerCase());
  const placesIt = /\b(your|the)\s+week\b|\bweek view\b|\bin plans\b/i.test(said);
  return !(namesIt && placesIt);
}
