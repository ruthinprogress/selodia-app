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
  // SEVEN QUESTIONS THEN CHAT (Ruth, 2 October 2026, item 6, built from her
  // approved preview rather than from my notes of it).
  //
  // WHAT CAME OUT, AND WHY IT IS NOT A LOSS. Her instruction: "Leave out intro,
  // equipment and first log."
  //
  //   intro        a screen that asked nothing and changed nothing. Her own rule
  //                from 28 September is that every answer must change something;
  //                a screen with no answer at all cannot pass it.
  //   equipment    collected and read by nobody. It was going to matter when
  //                Sessions generate against it, and until then it was a minute
  //                spent for a row nothing reads.
  //   first-log    asking somebody to log a meal before she has seen the app is
  //                asking for work in exchange for nothing yet.
  //   steer-around a signpost into chat, now that allergies IS the steer-around
  //                screen with all five of her groups on it.
  //   medication   merged into "about your body", where her preview puts it, as a
  //                plain box rather than a conversation.
  //   guidance     a real preference and not one of her seven. It moves to
  //                Settings, and unset means the look-back is never nudged -
  //                which is the safe default for "nudge only if she chose Guide
  //                me".
  //
  // THE ORDER IS HERS AND THE FIRST SCREEN IS THE ARGUMENT. Every earlier version
  // opened on the body. The app's purpose is to take mental load off, reduce
  // friction and stress, and support long-term health, so it opens on how she
  // wants her days to feel.
  // HER ORDER, 5 October 2026, and the logic is hers too: "1. how do your days
  // feel, 2. approach, 3. How active are you?, 4. what do you already do,
  // 5. something you would like to do, 6. anything to steer, 7. about body".
  //
  // WHAT MOVED AND WHY. The activity level was a settings page; it is a question
  // now, and it sits directly after the approach because the approach decides
  // what the figure is FOR and the level decides what it is built on. The panel
  // on step 2 already quotes it, so being asked next is the first point at which
  // it means anything. "Something you would like to do" drops from third to
  // fifth, after the activities she already has, which is the order a person
  // thinks in: what my week is, then what I would like to add to it.
  //
  // FIRST DRAFT IS NOT ONE OF THE SEVEN. It is the draft the seven produce, not
  // a question about her, which is also what makes her seven seven.
  { route: 'consent', label: 'Your data', kind: 'configuration' },
  { route: 'account', label: 'Your account', kind: 'configuration' },
  { route: 'days', label: 'How your days feel', kind: 'configuration' },
  { route: 'goals', label: 'Your approach', kind: 'configuration' },
  { route: 'activity-level', label: 'How active you are', kind: 'configuration' },
  { route: 'activities', label: 'What you already do', kind: 'configuration' },
  { route: 'skill', label: 'Something to work on', kind: 'configuration' },
  { route: 'allergies', label: 'What to steer around', kind: 'configuration' },
  { route: 'life-stage', label: 'About your body', kind: 'configuration' },
  { route: 'first-draft', label: 'Your first draft', kind: 'configuration' },
];

// WHY EVERY SCREEN IS 'configuration' NOW. The Body Manual distinction existed to
// warn her when a question had no feature behind it - "a question whose answer
// changes nothing costs a minute and buys a false sense of being understood". The
// seven that remain all change something the same day: how she is spoken to, her
// targets, her Skills, her week, the food filter, how a cycle day is read. There
// is nothing left in the chain that needs the warning, so nothing carries it.
//
// The flag and BODY_MANUAL_NOTE stay, because the Manual screens still exist off
// the chain and the next question with no feature behind it should say so.

// NOT IN THE LIST, ON PURPOSE, AND THIS IS NOT THE PLACE TO FIX IT.
// `health-context`, `technical`, `nutrition` and `activity` are real screens
// with real code, but nothing in the push chain reaches them any more - they
// are only arrived at through RESUME_ROUTE, which still names steps the chain
// above no longer visits. Listing them would put a wrong denominator in front
// of everybody who never sees them. Leaving them out costs them a count and
// nothing else, now that the header keeps its button either way. The real
// answer is the onboarding redesign Ruth has queued, and she has said not to
// start it yet, so this records the fault rather than quietly papering it.

// THE COUNT IS THE CONFIGURATION CHAIN, NOT EVERY SCREEN (30 September 2026).
//
// The Body Manual screens are offered rather than required, so counting them
// would promise a longer setup than anybody has to do and would make the
// denominator wrong for the person who skips them - which is most people, most
// of the time. They keep their title and their note and simply carry no
// "4 of 11"; the header has drawn its action independently of the count since
// the night the whole flow lost its Continue button.
/**
 * THE QUESTIONS SHE IS ASKED: consent and account are not among them.
 *
 * Her approved preview reads "Getting to know you \u00b7 1 of 7", and the seven are
 * the questions. Consent and creating an account are things that happen before
 * the questions start - they are not optional, they are not skippable, and
 * neither is a question about her. Counting them gave "1 of 9" on the screen she
 * approved as "1 of 7", and made the first question look like the third.
 */
export const COUNTED_SCREENS = ONBOARDING_SCREENS.filter(
  (s) =>
    s.kind === 'configuration' &&
    s.route !== 'consent' &&
    s.route !== 'account' &&
    // AND NOT THE FIRST DRAFT (5 October 2026). Her seven are questions about
    // her; the draft is what they produce. Counting it would make the last
    // question "6 of 7" and the summary "7 of 7", which is the app calling its
    // own answer a question.
    s.route !== 'first-draft'
);

export const ONBOARDING_TOTAL = COUNTED_SCREENS.length;

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
  /** 1-based, for display. Null on a Body Manual screen, which is not a step. */
  index: number | null;
  total: number | null;
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
  const screen = ONBOARDING_SCREENS.find((s) => s.route === last);
  if (!screen) return null;
  // A Body Manual screen has a label and no position: it is not a step on the
  // way to anything, it is a thing she chose to add.
  if (screen.kind === 'manual') return { index: null, total: null, label: screen.label };
  // THE SAME SET THE TOTAL COUNTS, or the numerator and the denominator
  // disagree. Consent and account carry a title and no position: they are not
  // questions, so "1 of 7" starts at the first question.
  const at = COUNTED_SCREENS.findIndex((s) => s.route === screen.route);
  if (at < 0) return { index: null, total: null, label: screen.label };
  return {
    index: at + 1,
    total: ONBOARDING_TOTAL,
    label: screen.label,
  };
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
  // OFF THE CHAIN AND STILL REACHABLE, so still never policed. The seven
  // questions no longer walk through these, but they are real files with real
  // routes: RESUME_ROUTE can still land on one for somebody mid-setup from an
  // older build, the first draft offers the Manual chain, and any of them can be
  // opened directly. A screen somebody can legitimately be on must not be
  // thrown out of.
  //
  // THE LIST GREW ON 2 OCTOBER with the four the new flow dropped. Leaving them
  // out would have reproduced exactly the bug this set was built to stop: a
  // finished account opening one gets thrown back to the app, an unfinished one
  // gets dragged into the flow.
  'health-context',
  'technical',
  'nutrition',
  'activity',
  'intro',
  'equipment',
  'first-log',
  'steer-around',
  'medication',
  'guidance',
]);
