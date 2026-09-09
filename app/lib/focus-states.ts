import type { SupabaseClient } from '@supabase/supabase-js';

// Setting Fat Focus and Muscle Focus, by inferring and then asking.
//
// THE BUG THIS CLOSES. Until 2026-09-09 nothing in the app wrote these columns.
// They were read in four places and written in zero, so every calorie target the
// app had ever shown was a maintenance target regardless of what the person
// wanted - and it stayed invisible because the fallback for null IS 'maintain',
// so the wrong answer and the right answer coincided.
//
// WHY NOT A SETTING, AND WHY NOT A SILENT INFERENCE. A control would be one of
// almost no controls in an app built around a single text box. A silent inference
// would let a model decide somebody was in a deficit and quietly move the number
// on their bar, which is the paternalism Part Two's principles rule out and a
// worse failure than the one being fixed. So Selodía notices, says what it
// noticed, and asks - and nothing changes until the person says yes.
//
// THE OFFER IS STORED, NOT REMEMBERED. The pending_* columns exist because the
// alternative is trusting the model to recall across turns what it proposed, and
// a confirmation applied against a misremembered proposal sets somebody's target
// to something nobody chose. The database holds the offer; the model only reports
// whether the answer was yes. Same split as the allergy gate and the goal check:
// the model observes, the app decides.

export type FocusState = 'reduce' | 'maintain' | 'increase';
const STATES: FocusState[] = ['reduce', 'maintain', 'increase'];

export function coerceFocus(v: unknown): FocusState | null {
  return typeof v === 'string' && (STATES as string[]).includes(v) ? (v as FocusState) : null;
}

export type PendingFocus = {
  fat: FocusState | null;
  muscle: FocusState | null;
  askedAt: string | null;
};

export type FocusProfile = {
  fat_focus_state?: string | null;
  muscle_focus_state?: string | null;
  pending_fat_focus?: string | null;
  pending_muscle_focus?: string | null;
  pending_focus_asked_at?: string | null;
};

// An offer nobody answered is not an offer any more.
//
// A week, because the question is genuinely low-stakes to re-ask and genuinely
// annoying to have hanging: somebody who ignored it once has effectively said
// "not now", and treating a fortnight-old "shall I set you to reduce?" as still
// live would apply it on the strength of a yes that answered something else.
const PENDING_TTL_DAYS = 7;

export function readPending(profile: FocusProfile | null): PendingFocus {
  const askedAt = profile?.pending_focus_asked_at ?? null;
  if (!askedAt) return { fat: null, muscle: null, askedAt: null };
  const age = Date.now() - new Date(askedAt).getTime();
  if (!Number.isFinite(age) || age > PENDING_TTL_DAYS * 86_400_000) {
    return { fat: null, muscle: null, askedAt: null };
  }
  return {
    fat: coerceFocus(profile?.pending_fat_focus),
    muscle: coerceFocus(profile?.pending_muscle_focus),
    askedAt,
  };
}

const label = (s: FocusState, which: 'fat' | 'muscle'): string => {
  if (which === 'fat') {
    return s === 'reduce' ? 'losing some fat' : s === 'increase' ? 'gaining weight' : 'holding steady';
  }
  return s === 'reduce' ? 'carrying less muscle' : s === 'increase' ? 'building muscle' : 'holding steady';
};

/**
 * What the model is told when an offer is outstanding.
 *
 * It states the offer as fact - the app made it, it is in the database - and asks
 * the model only to read the answer. It must not re-propose, re-argue, or treat
 * silence as agreement.
 */
export function pendingFocusPrompt(pending: PendingFocus): string {
  if (!pending.askedAt || (!pending.fat && !pending.muscle)) return '';
  const parts = [
    pending.fat ? `their fat focus to ${label(pending.fat, 'fat')}` : null,
    pending.muscle ? `their muscle focus to ${label(pending.muscle, 'muscle')}` : null,
  ].filter(Boolean);

  return `

YOU ALREADY ASKED THEM ABOUT THIS AND ARE WAITING ON AN ANSWER. In an earlier turn you offered to set ${parts.join(' and ')}, and they have not answered yet.

If THIS message answers it, set focusAnswer to 'yes' or 'no'. Treat a clear agreement as yes ("go on", "yeah do that", "sounds right") and a clear decline as no ("leave it", "not yet", "no thanks"). Anything else - a new topic, a log, a different question - is NOT an answer: leave focusAnswer unset and simply carry on with what they actually said.

Do not raise it again yourself, do not rephrase the offer, and never treat them moving on as agreement. If they answer yes, the app makes the change and tells them; acknowledge it naturally in one short clause and do not describe targets or numbers you have not been given.`;
}

/**
 * Record a proposal and the fact that it was asked. Does NOT change the states.
 */
export async function storePendingFocus(
  supabase: SupabaseClient,
  userId: string,
  fat: FocusState | null,
  muscle: FocusState | null
): Promise<void> {
  if (!fat && !muscle) return;
  const { error } = await supabase.from('user_profile').upsert({
    user_id: userId,
    pending_fat_focus: fat,
    pending_muscle_focus: muscle,
    pending_focus_asked_at: new Date().toISOString(),
  });
  if (error) console.log('FOCUS: could not store the proposal —', error.message);
}

export async function clearPendingFocus(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase.from('user_profile').upsert({
    user_id: userId,
    pending_fat_focus: null,
    pending_muscle_focus: null,
    pending_focus_asked_at: null,
  });
  if (error) console.log('FOCUS: could not clear the proposal —', error.message);
}

/**
 * Apply a confirmed proposal, and stamp WHEN each state changed.
 *
 * The stamp is only touched when the value actually differs. Item 24's
 * consolidation trigger asks how long both have been at maintain, so
 * re-confirming a state somebody is already in must not restart a clock they are
 * eight weeks into.
 */
export async function applyPendingFocus(
  supabase: SupabaseClient,
  userId: string,
  profile: FocusProfile | null,
  pending: PendingFocus
): Promise<{ fat: FocusState | null; muscle: FocusState | null }> {
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    user_id: userId,
    pending_fat_focus: null,
    pending_muscle_focus: null,
    pending_focus_asked_at: null,
  };

  if (pending.fat) {
    update.fat_focus_state = pending.fat;
    if (profile?.fat_focus_state !== pending.fat) update.fat_focus_since = now;
  }
  if (pending.muscle) {
    update.muscle_focus_state = pending.muscle;
    if (profile?.muscle_focus_state !== pending.muscle) update.muscle_focus_since = now;
  }

  const { error } = await supabase.from('user_profile').upsert(update);
  if (error) {
    console.log('FOCUS: could not apply the confirmed change —', error.message);
    return { fat: null, muscle: null };
  }
  return { fat: pending.fat, muscle: pending.muscle };
}

/**
 * What Selodía adds once the change has actually been made.
 *
 * Written by the app, not the model, for the same reason the save confirmations
 * are: it is a statement about what the app DID, and the model composed its reply
 * before any of this ran, so it cannot honestly claim it.
 */
export function focusAppliedNote(applied: { fat: FocusState | null; muscle: FocusState | null }): string | null {
  if (!applied.fat && !applied.muscle) return null;
  const bits = [
    applied.fat ? `fat focus to ${label(applied.fat, 'fat')}` : null,
    applied.muscle ? `muscle focus to ${label(applied.muscle, 'muscle')}` : null,
  ].filter(Boolean);
  return `I've set your ${bits.join(' and your ')}. Your daily targets will shift to match from now on — you can change it any time by telling me.`;
}
