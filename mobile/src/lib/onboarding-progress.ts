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
};

export const ONBOARDING_SCREENS: OnboardingScreen[] = [
  { route: 'consent', label: 'Before we start' },
  { route: 'account', label: 'Your account' },
  { route: 'intro', label: 'Hello' },
  { route: 'equipment', label: 'What you have' },
  { route: 'first-log', label: 'Your first log' },
  { route: 'goals', label: 'What matters to you' },
  { route: 'health-context', label: 'Anything to know' },
  { route: 'technical', label: 'How tracking works' },
  { route: 'nutrition', label: 'Your targets' },
  { route: 'activity', label: 'How you move' },
];

export const ONBOARDING_TOTAL = ONBOARDING_SCREENS.length;

// The phase title. Avoids the word "onboarding" — that is internal product
// vocabulary, and Unflump would never say it. This names a bounded setup phase
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
