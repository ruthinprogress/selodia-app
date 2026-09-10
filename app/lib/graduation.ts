import type { SupabaseClient } from '@supabase/supabase-js';
import { HABIT_WINDOW_DAYS, type HabitWindow } from './habit-window';

// Part Eleven, steps 2 to 5: consolidation, the offer, and lite mode.
//
// Build item 24, and the half of it that is trigger logic. Steps 6 to 10 - weekly
// check-ins, adaptive cadence, the two-year celebration - need scheduled delivery
// and are a separate build; nothing here pretends otherwise.
//
// WHAT MAKES THIS DIFFERENT FROM EVERY OTHER TRIGGER IN THE APP. It asks somebody
// whether they still need the app. Part Two, principle: "the purpose is to help
// someone understand their own patterns well enough to build real behaviour
// change, then need Selodía less over time." So the failure mode here is not a
// missed trigger, it is an offer made too eagerly or repeated - either of which
// turns a genuine question into a performance of one.
//
// A MODEST OFFER, NOT A CELEBRATION. The spec is explicit that celebration is
// reserved for step 8, and the copy at step 4 is quoted verbatim in Part Eleven.
// Nothing here congratulates anybody.

// Nine weeks at maintain, per Part Eleven step 3. Expressed via the habit
// window's own constant so the two nine-weeks can never drift into different
// numbers - they are the same nine weeks by design.
export const CONSOLIDATION_DAYS = HABIT_WINDOW_DAYS;

export type ConsolidationVerdict =
  | { eligible: false; reason: 'not-maintaining' | 'too-soon' | 'not-enough-data' | 'already-asked' }
  | { eligible: true; daysSustained: number };

export type ConsolidationInputs = {
  fatFocus: string | null | undefined;
  muscleFocus: string | null | undefined;
  fatSince: string | null | undefined;
  muscleSince: string | null | undefined;
  offeredAt: string | null | undefined;
  window: HabitWindow;
  now?: Date;
};

const daysSince = (iso: string | null | undefined, now: Date): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((now.getTime() - t) / 86_400_000);
};

/**
 * Should the consolidation offer be made?
 *
 * ONE ADDITION TO THE SPEC'S LITERAL CONDITION, flagged rather than slipped in.
 * Part Eleven's steps 2-3 say only "both sustained at maintain" for nine weeks.
 * Taken literally, somebody who set maintain and then stopped using the app for
 * two months qualifies - and would be told "that's real, sustained work", which
 * is the offer's own quoted wording. That would be false praise, which Part Two
 * forbids more strongly than it requires this trigger to fire.
 *
 * So the offer also needs them to have been logging on MORE DAYS THAN NOT across
 * the window. Half is not a performance bar and is deliberately far below the
 * taper's strict 100%: it is the floor at which the sentence is true. Somebody
 * below it has not been in consolidation, they have been away, and the right
 * response to that is not a graduation offer.
 */
export function assessConsolidation(input: ConsolidationInputs): ConsolidationVerdict {
  const now = input.now ?? new Date();

  if (input.offeredAt) return { eligible: false, reason: 'already-asked' };
  if (input.fatFocus !== 'maintain' || input.muscleFocus !== 'maintain') {
    return { eligible: false, reason: 'not-maintaining' };
  }

  const fatDays = daysSince(input.fatSince, now);
  const muscleDays = daysSince(input.muscleSince, now);
  // No stamp means the state predates the capture mechanism (2026-09-09) or was
  // set by hand. Either way nothing is known about how long it has held, and
  // "unknown" must not be read as "long enough" - the clock starts when the app
  // starts watching, which costs an existing user nine weeks and is the honest
  // trade.
  if (fatDays == null || muscleDays == null) return { eligible: false, reason: 'not-enough-data' };

  const sustained = Math.min(fatDays, muscleDays);
  if (sustained < CONSOLIDATION_DAYS) return { eligible: false, reason: 'too-soon' };

  if (input.window.windowDays === 0) return { eligible: false, reason: 'not-enough-data' };
  if (input.window.fullDays * 2 < input.window.windowDays) {
    return { eligible: false, reason: 'not-enough-data' };
  }

  return { eligible: true, daysSustained: sustained };
}

// The offer, quoted verbatim from Part Eleven step 4.
//
// Handed to the model as the thing to say rather than composed by it, because it
// is one of the few lines in this app that was written word by word in the spec -
// and because "how do you feel about it?" is doing specific work that a
// paraphrase would round off into a yes/no question.
export const CONSOLIDATION_OFFER_BLOCK = `

THIS PERSON HAS BEEN AT MAINTAIN ON BOTH FOCUS STATES FOR OVER NINE WEEKS, and has been logging steadily through it. The app has worked this out; you do not need to and must not show any calculation, count of weeks, or figure.

Somewhere natural in this reply, make this offer, in these words or very close to them:

"You've been in maintenance for both Fat Focus and Muscle Focus for a while now - that's real, sustained work. How do you feel about it? Do you want to keep logging for a while longer, or would you like to see if you can fly solo for a while and see if it's become intuitive behaviour?"

IT IS AN OFFER, NOT A CELEBRATION and not a nudge toward either answer. Do not congratulate them, do not use celebration language, and do not imply that carrying on logging would be a failure to progress or that stopping would be a risk. Both answers are equally fine and the question is genuine.

Ask once. If they change the subject, let it go entirely - the app records that it was asked and will not raise it again.`;

export const LITE_MODE_STANDING_BLOCK = `

THEY ARE IN LITE MODE - they chose to stop logging for a while and see whether it has become intuitive. This is a designed, successful outcome, not a lapse.

Do not nudge them to log, do not ask why they have not logged, and never frame returning to logging as getting back on track. Everything still works if they want it: their data, the Almanac and this conversation are all fully available, and they can reopen any area simply by saying so. If they log something anyway, respond exactly as you always would, with no remark about them logging again.`;

/**
 * Record that the offer was made. Called on the turn it goes out.
 */
export async function markConsolidationOffered(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_profile')
    .upsert({ user_id: userId, consolidation_offered_at: new Date().toISOString() });
  if (error) console.log('CONSOLIDATION: could not record the offer —', error.message);
}

/**
 * Enter lite mode: pause each logging area, reversibly.
 *
 * PAUSING IS PER-AREA AND REVERSIBLE, per Part Eleven step 5 - "freezing rather
 * than declining or penalizing". These three columns are timestamps rather than
 * booleans precisely so unpausing is setting one back to null and nothing is
 * lost, and so the app can say when the pause began if it ever needs to.
 *
 * NOTHING IS DELETED AND NOTHING IS HIDDEN. Data, the Almanac and chat all stay
 * fully available; what pauses is the app's own expectation of daily entries.
 */
export async function enterLiteMode(supabase: SupabaseClient, userId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from('user_profile').upsert({
    user_id: userId,
    consolidation_answer: 'solo',
    lite_mode_since: now,
    food_paused_at: now,
    body_paused_at: now,
    activity_paused_at: now,
  });
  if (error) console.log('CONSOLIDATION: could not enter lite mode —', error.message);
}

/**
 * They would rather keep logging. Records the answer and changes nothing else.
 */
export async function declineConsolidation(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_profile')
    .upsert({ user_id: userId, consolidation_answer: 'keep_logging' });
  if (error) console.log('CONSOLIDATION: could not record the answer —', error.message);
}

export function isInLiteMode(profile: { lite_mode_since?: string | null } | null): boolean {
  return !!profile?.lite_mode_since;
}
