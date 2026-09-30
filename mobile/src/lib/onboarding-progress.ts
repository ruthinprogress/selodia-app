// Onboarding progress (build item 48).
//
// Live device testing found there was no sense of progress or remaining scope
// anywhere in onboarding — no indication of how far through you were, or that
// there was a defined end at all. This is the ordered list that fixes it.
//
// Deliberately SEPARATE from ONBOARDING_STEPS in onboarding-step.ts. That list
// is the persisted resume state and starts at `intro`, because consent and
// account happen before a session exists and so can never be written to
// user_profile. From the person's side, though, those two are unmistakably
// steps — they are the first two things they do. Counting them is the honest
// answer to "how far through am I", so the display list includes them and the
// persistence list does not.

export type OnboardingScreen = {
  // The route segment under /onboarding/.
  route: string;
  // Fixed, human labels. Never generated and never model-authored: a progress
  // indicator that could vary between renders would undermine the exact thing
  // it exists to provide.
  label: string;
  // CONFIGURATION OR BODY MANUAL (Ruth, 30 September 2026).
  //
  // "Onboarding exists to build the foundations of Selodia. It creates two
  // complementary models." Configuration is what the app needs to function
  // today - it powers the calorie and protein arithmetic, Plans, Sessions and
  // reports, and changes her experience the moment she answers. The Body Manual
  // is a living physiological record: "not every field needs an immediate
  // feature", and it becomes more valuable over years rather than weeks.
  //
  // WHY THE DISTINCTION IS IN THE DATA AND NOT JUST IN THE DESIGN DOC. Her
  // original onboarding rule was that "a question whose answer changes nothing
  // costs a minute and buys a false sense of being understood". The Body Manual
  // deliberately collects things with no immediate feature, which breaks that
  // rule unless SHE IS TOLD WHICH IS WHICH. A Manual question that quietly
  // implies it is doing something today is the same false sense of being
  // understood wearing a better name. So the screen says so, and the flag below
  // is what makes it say so.
  kind: 'configuration' | 'manual';
};

export const ONBOARDING_SCREENS: OnboardingScreen[] = [
  // 'Before we start' until 2026-09-03, when it started competing with the
  // screen's own heading. Consent is the only onboarding screen that is a form
  // rather than a conversation, so it is the only one carrying a heading of its
  // own - and once that heading became "Welcome to Selodia", the header read
  // "Getting to know you", then "Before we start", then a third greeting. This
  // label now names the step in the same voice as its siblings and leaves the
  // welcoming to the heading.
  { route: 'consent', label: 'Your data' , kind: 'configuration' },
  { route: 'account', label: 'Your account' , kind: 'configuration' },
  { route: 'intro', label: 'Hello' , kind: 'configuration' },
  { route: 'equipment', label: 'What you have' , kind: 'configuration' },
  { route: 'first-log', label: 'Your first log' , kind: 'configuration' },
  { route: 'goals', label: 'What matters to you' , kind: 'configuration' },
  // ADDED 30 SEPTEMBER 2026, AND THE OMISSION WAS THE TRAP. The seven screens
  // below have been in the push chain since the spine was rebuilt and were
  // never added here. That alone should have been cosmetic - a screen without a
  // count - but the Continue button lives in the same header as the count, and
  // the header hid itself on any screen it did not recognise. So the whole of
  // the flow after Goals had no way forward. See onboarding-header.tsx: the
  // header no longer hides its action, so a future omission costs a number
  // rather than the way out.
  { route: 'skill', label: 'Something to work on' , kind: 'configuration' },
  { route: 'life-stage', label: 'Where you are' , kind: 'manual' },
  { route: 'activities', label: 'How you move' , kind: 'configuration' },
  { route: 'steer-around', label: 'What to steer around' , kind: 'manual' },
  // Added 30 September 2026. A Body Manual screen: it opens chat rather than
  // saving, because a medication list is exactly where an interpretation can be
  // confidently wrong. See medication.tsx for the full reasoning, and for the
  // asymmetry it closes - HRT was the only medication the app had ever asked
  // about, which is fine as a start and strange as a resting state.
  { route: 'medication', label: 'What you take', kind: 'manual' },
  { route: 'allergies', label: 'Anything to avoid' , kind: 'configuration' },
  { route: 'guidance', label: 'How much to steer' , kind: 'configuration' },
  { route: 'first-draft', label: 'Your first draft' , kind: 'configuration' },
];

// NOT IN THE LIST, ON PURPOSE, AND THIS IS NOT THE PLACE TO FIX IT.
// `health-context`, `technical`, `nutrition` and `activity` are real screens
// with real code, but nothing in the push chain reaches them any more - they
// are only arrived at through RESUME_ROUTE, which still names steps the chain
// above no longer visits. Listing them would put a wrong denominator in front
// of everybody who never sees them. Leaving them out costs them a count and
// nothing else, now that the header keeps its button either way. The real
// answer is the onboarding redesign Ruth has queued, and she has said not to
// start it yet, so this records the fault rather than quietly papering it.

export const ONBOARDING_TOTAL = ONBOARDING_SCREENS.length;

/**
 * Is this screen building the Body Manual rather than configuring the app?
 *
 * The header uses it to say so, quietly, once per screen. Nothing else changes:
 * a Manual screen is answered, skipped and edited exactly like any other.
 */
export function isBodyManual(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const last = pathname.split('?')[0].replace(/\/+$/, '').split('/').filter(Boolean).pop();
  return ONBOARDING_SCREENS.some((s) => s.route === last && s.kind === 'manual');
}

/**
 * The line a Body Manual screen carries.
 *
 * DELIBERATELY NOT AN APOLOGY AND NOT A SELL. It says what the answer is for
 * and what it is not for, which is the whole of the honesty this distinction
 * exists to keep.
 */
export const BODY_MANUAL_NOTE =
  'For your record rather than today\u2019s numbers. It helps Selod\u00eda make sense of things later, and you can add to it any time.';

// The phase title. Avoids the word "onboarding" — that is internal product
// vocabulary, and Selodia would never say it. This names a bounded setup phase
// in the person's own terms, which is orientation rather than a fourth-wall
// break: the rule there is about never revealing build status, not about
// refusing to say where someone is.
export const ONBOARDING_TITLE = 'Getting to know you';

export type OnboardingProgress = {
  index: number; // 1-based, for display
  total: number;
  label: string;
};

// Resolve a router pathname to its place in the flow, or null when the path
// isn't an onboarding screen — so the header simply doesn't render rather than
// guessing at a position it doesn't have.
export function progressForPath(pathname: string | null | undefined): OnboardingProgress | null {
  if (!pathname) return null;
  // Tolerate trailing slashes, query strings and the leading group segment.
  const clean = pathname.split('?')[0].replace(/\/+$/, '');
  const last = clean.split('/').filter(Boolean).pop();
  if (!last) return null;
  const i = ONBOARDING_SCREENS.findIndex((s) => s.route === last);
  if (i < 0) return null;
  return { index: i + 1, total: ONBOARDING_TOTAL, label: ONBOARDING_SCREENS[i].label };
}

// THE SCREENS THE AUTH GUARD MUST NEVER POLICE, derived from the list above
// rather than hand-copied beside it.
//
// 30 SEPTEMBER 2026: IT WAS HAND-COPIED, AND IT WENT STALE IN EXACTLY THE SAME
// WAY. use-auth-guard.ts carried its own literal set of eight screen names,
// missing the same seven that were missing from ONBOARDING_SCREENS - so a
// finished account that opened one of them was thrown straight back to the app,
// while an unfinished one was dragged back into the flow. Two lists of the same
// thing, maintained by memory, drifting together. One list now, and adding a
// screen to the flow tells both.
//
// The four legacy routes are added on purpose: nothing in the push chain
// reaches them any more, but RESUME_ROUTE still can, and a screen somebody can
// legitimately be on must not be policed. See the note above.
export const FLOW_SCREENS: ReadonlySet<string> = new Set([
  ...ONBOARDING_SCREENS.map((s) => s.route).filter((r) => r !== 'consent' && r !== 'account'),
  'health-context',
  'technical',
  'nutrition',
  'activity',
]);
