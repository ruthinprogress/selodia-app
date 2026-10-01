import type { SupabaseClient } from '@supabase/supabase-js';
import type { Href } from 'expo-router';

import { ONBOARDING_SCREENS } from '@/lib/onboarding-progress';

// WHERE SOMEBODY WHO HAS NOT FINISHED SETUP COMES BACK TO.
//
// Ruth, 1 October 2026: "Repair RESUME_ROUTE so it covers every current setup
// screen, so nobody is ever bounced to an old or wrong screen."
//
// WHAT WAS WRONG, and it was two faults wearing one coat.
//
// The step list below had not been touched since the spine was rebuilt. It named
// `health_context`, `technical_targets`, `nutrition_targets` and `activity_tdee`
// - four screens nothing in the push chain reaches any more - and knew nothing
// about `skill`, `life-stage`, `steer-around`, `medication`, `allergies` or
// `guidance`, which are six of the screens somebody actually walks through.
//
// So an unfinished account that touched the app was sent to RESUME_ROUTE[step],
// and the best that list could do was a screen from a flow that no longer runs.
// That is what turned "tap yes on the medication screen" into "you are now on
// the TDEE screen and the question you were answering is gone": the screen
// pushed into the tabs, the guard saw an unfinished account in the tabs, and the
// old map sent her somewhere she had never been.
//
// ONE LIST NOW. The steps are DERIVED from ONBOARDING_SCREENS, which is already
// the authoritative order and already feeds the progress count and the auth
// guard's allow-list. onboarding-progress.ts has the note about what happened
// the last time two lists of the same screens were maintained side by side: they
// drifted, and the flow lost its Continue button. A third hand-maintained copy
// here would have been the same bet a third time.
//
// THE OLD NAMES ARE KEPT AND POINTED SOMEWHERE SENSIBLE. Accounts in the
// database still hold values like 'technical_targets'. Dropping them from the
// map would make RESUME_ROUTE[step] undefined and router.replace(undefined) is
// not a redirect, it is a crash on the one path that exists to rescue somebody.
// So every historical value resolves, and anything unrecognised resolves too.

/**
 * The persisted resume state, in flow order.
 *
 * `consent` and `account` are absent on purpose and always have been: they
 * happen before a session exists, so they can never be written to user_profile.
 * A signed-in person therefore never resumes to them.
 */
const asStep = (route: string) => route.replace(/-/g, '_');
const WALKED = ONBOARDING_SCREENS.filter((s) => s.route !== 'consent' && s.route !== 'account');

export const ONBOARDING_STEPS = [
  'not_started',
  // THE CONFIGURATION CHAIN, in the order it is actually walked.
  ...WALKED.filter((s) => s.kind === 'configuration').map((s) => asStep(s.route)),
  // THEN THE BODY MANUAL, AND THIS ORDER IS NOT THE DISPLAY ORDER ON PURPOSE.
  //
  // ONBOARDING_SCREENS interleaves the Manual screens with the configuration
  // ones, because that is where they belong in the story of the flow. The PUSH
  // CHAIN does not: goals -> skill -> activities -> allergies -> guidance ->
  // first-draft, and the Manual screens are reached only from "Add more about
  // you" on first-draft, after all of that.
  //
  // advanceOnboardingStep is forward-only by INDEX, so using the display order
  // here would have been silently destructive: life-stage sits before activities
  // in that list, so arriving at it from first-draft would score LOWER than the
  // step already stored and the write would be skipped. Somebody who closed the
  // app halfway through the Manual would then resume at `guidance` - an earlier
  // screen they had already finished - which is precisely the bounce this file
  // was reopened to remove.
  ...WALKED.filter((s) => s.kind === 'manual').map((s) => asStep(s.route)),
  'complete',
] as const;

export type OnboardingStep = string;

/**
 * Historical values that are still in the database and name screens the flow no
 * longer visits.
 *
 * EACH ONE RESOLVES TO WHERE THAT PERSON ACTUALLY GOT TO, not to the dead screen
 * itself. The four below all came after Goals in the old flow and were the
 * numbers-and-targets chain; everybody who holds one of them answered Goals, so
 * Goals is where the current flow picks them up. Sending them to `technical`
 * instead would be correct about history and useless to them - that screen is no
 * longer on the way to anything.
 */
const LEGACY_STEPS: Record<string, string> = {
  health_context: 'goals',
  technical_targets: 'goals',
  nutrition_targets: 'goals',
  activity_tdee: 'goals',
  first_log: 'first_log',
};

/** The first screen of the flow proper, and the answer when nothing else fits. */
const FIRST: Href = '/onboarding/intro';

/**
 * Where to send somebody, given whatever is stored on their account.
 *
 * TOTAL BY CONSTRUCTION. It takes a string rather than a union and always
 * returns a route, because the input comes out of a database column that has
 * held four different vocabularies over three months and will hold a fifth. An
 * unknown value resumes at the start, which is the only honest answer: it is the
 * one screen everybody has to pass through, every screen saves its own answers
 * as it goes, and advanceOnboardingStep is forward-only - so landing there
 * cannot undo anything they have already done.
 */
export function resumeRoute(step: string | null | undefined): Href {
  if (!step || step === 'not_started') return FIRST;
  if (step === 'complete') return '/';
  const route = LEGACY_STEPS[step] ?? step;
  const screen = ONBOARDING_SCREENS.find((s) => s.route.replace(/-/g, '_') === route);
  if (!screen) return FIRST;
  return `/onboarding/${screen.route}` as Href;
}

/**
 * A map, for the call sites and tests that want one.
 *
 * Built from the same function, so the two can never disagree - the previous
 * version of this file had a hand-written object literal, which is how it came
 * to name four screens that no longer exist.
 */
export const RESUME_ROUTE: Record<string, Href> = Object.fromEntries([
  ...ONBOARDING_STEPS.map((s) => [s, resumeRoute(s)]),
  ...Object.keys(LEGACY_STEPS).map((s) => [s, resumeRoute(s)]),
]);

/**
 * Forward-only: a step reached later is never overwritten by an earlier one.
 *
 * AN UNKNOWN CURRENT VALUE COUNTS AS THE BEGINNING. indexOf returns -1 for a
 * legacy name, and -1 < every real index, so an account holding
 * 'technical_targets' can be moved forward by the current flow rather than being
 * frozen at a step this list has never heard of.
 */
export async function advanceOnboardingStep(
  supabase: SupabaseClient,
  userId: string,
  step: OnboardingStep
) {
  const { data } = await supabase
    .from('user_profile')
    .select('onboarding_step')
    .eq('user_id', userId)
    .maybeSingle();

  const steps = ONBOARDING_STEPS as readonly string[];
  const currentIndex = data ? steps.indexOf(String(data.onboarding_step)) : 0;
  const targetIndex = steps.indexOf(step);
  // A step this list does not know is never written: it would be unresumable.
  if (targetIndex < 0) return;
  if (targetIndex <= currentIndex) return;

  await supabase.from('user_profile').upsert({ user_id: userId, onboarding_step: step });
}
