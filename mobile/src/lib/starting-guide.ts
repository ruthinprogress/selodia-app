import type { BodyMode } from './body-mode';

// YOUR STARTING GUIDE: FINAL TEXT (Ruth, 5 October 2026).
//
// Her instruction, and it is the whole of why this file exists:
//
//   "Add the 'Your starting guide' text block I pasted to the matrix as the
//   permanent record: one 'text shown on screen' entry per state (ten), with the
//   frame, the italic lines and the placeholders as written. The checks read it.
//   Do not paraphrase it."
//
// SO NOTHING HERE IS REWRITTEN, EVER, WITHOUT HER SAYING SO. Every sentence below
// is hers, verbatim, placeholders included. The app fills the braces; it does not
// edit the words around them. build-mode-matrix.mjs copies this file's text into
// scripts/mode-matrix.json, and check-starting-guide.mjs compares the two, so a
// paraphrase in either place fails before anybody sees it.
//
// TEN STATES, NOT EIGHT. Her list covers the eight combinations that produce a
// guide plus the two that do not - no approach chosen, and no weight known - which
// are the states the panel used to handle by saying nothing at all.
//
// NO EM DASHES. Her standing rule for anything in her voice.

export type GuideStateKey =
  | 'lose_fat'
  | 'lose_fat_build'
  | 'maintain'
  | 'maintain_build'
  | 'build'
  | 'gain'
  | 'gain_build'
  | 'none'
  | 'no_weight'
  | 'paused';

export type GuideState = {
  key: GuideStateKey;
  /** What this state is called in the matrix. Never shown on screen. */
  name: string;
  /** The approach paragraph, hers, verbatim. */
  paragraph: string;
  /** The quiet serif italic, where she has one. */
  italic?: string;
  /** The small line under the paragraph, where she has one. */
  smallLine?: string;
  /** Whether this state shows the two figures and the closing line. */
  showsFigures: boolean;
  /**
   * The line behind "The working", where a state has one.
   *
   * Ruth, 5 October 2026: "add it to the collapsed working for Lose fat ONLY, not
   * the main panel... It's an important piece of body literacy nearly lost."
   *
   * IT IS NOT ON THE PANEL ITSELF, and that placement is the decision. A rate in
   * kilos on the face of the screen reads as a promise and invites her to weigh
   * herself against it; the same sentence one tap down is there for somebody
   * asking how the figure works, which is what a working is for.
   */
  working?: string;
  /** What the state teaches. Her matrix note, not shown on screen. */
  teaches?: string;
};

/** The frame every state that shows a guide is drawn in. */
export const GUIDE_FRAME = {
  title: 'Your starting guide',
  /** What the collapsed section is called. Her word for it. */
  workingLabel: 'The working',
  intro: "Based on what you've told Selodía:",
  restBullet: 'Your body uses about {resting} kcal a day at rest.',
  activityBullet: 'With {activity phrase}, that becomes about {activity kcal} kcal a day.',
  /**
   * The accessible name on the activity link.
   *
   * HER NOTE, VERBATIM: "{activity phrase} is the live, underlined link;
   * accessible name 'Change activity level'; no bracketed text."
   */
  activityLinkLabel: 'Change activity level',
  guideFigure: 'Around {guide} kcal a day',
  proteinFigure: '{protein low}–{protein high} g protein a day',
  closing:
    'These are starting estimates, and nothing here is fixed. If your activity, body or approach changes, your guide changes with it.',
  /** The shorter close, used only where there is no guide yet. */
  closingNoGuide: 'Nothing here is fixed.',
} as const;

export const GUIDE_STATES: GuideState[] = [
  {
    key: 'lose_fat',
    name: 'Lose fat',
    paragraph:
      "You've chosen to lose fat, so Selodía sets a gentle calorie deficit. It never goes below what your body uses at rest, and protein stays high to help protect your muscle.",
    // HER WORDING (5 October 2026). The second sentence is the half that stops
    // the first being a schedule: the scale moves more than this in a day, for
    // reasons that have nothing to do with fat.
    working:
      'At this pace the sum comes to roughly {weekly kg} kg of fat a week. Real life is less tidy, and your weight on the scale moves around more than that.',
    showsFigures: true,
    teaches: 'Deficits are gentle and muscle is worth protecting.',
  },
  {
    key: 'lose_fat_build',
    name: 'Lose fat + Build muscle',
    paragraph:
      "You've chosen to lose fat and build muscle. Building muscle needs enough protein and a reason for the muscle to grow, usually strength training. So Selodía keeps your guide close to what your body uses, instead of pushing it as low as possible.",
    italic: 'Any change comes from protein and training, not simply from eating less.',
    showsFigures: true,
    teaches: 'Protein and training drive the change, not a bigger deficit.',
  },
  {
    key: 'maintain',
    name: 'Maintain weight',
    paragraph:
      "You've chosen to maintain your weight, so Selodía keeps your guide around what your body uses. The aim is for your weight to stay broadly where it is.",
    showsFigures: true,
    teaches: 'Holding steady is an active choice.',
  },
  {
    key: 'maintain_build',
    name: 'Maintain weight + Build muscle',
    paragraph:
      "You've chosen to maintain your weight and build muscle. Building muscle needs enough protein and a reason for the muscle to grow, usually strength training. So Selodía keeps your guide around what your body uses and raises protein to support recovery and growth.",
    // NOT THE SAME ITALIC AS LOSE FAT + BUILD MUSCLE. Hers ends "eating more"
    // here and "eating less" there, which is the difference between the two
    // states said in one word.
    italic: 'Any change comes from protein and training, not simply from eating more.',
    showsFigures: true,
  },
  {
    key: 'build',
    name: 'Build muscle',
    paragraph:
      "You've chosen to build muscle. Building muscle needs enough energy, enough protein and a reason for the muscle to grow, usually strength training. So Selodía adds a small surplus, about 5% above what your body uses, and keeps protein at the top of its range.",
    italic: 'Extra energy helps, but protein and training are what build muscle.',
    showsFigures: true,
    teaches: 'Muscle needs energy, protein and training.',
  },
  {
    key: 'gain',
    name: 'Gain weight',
    paragraph:
      "You've chosen to gain weight, so Selodía adds a small, steady surplus: about a quarter of a percent of your weight a week, around {surplus} kcal a day. Gentle is deliberate, because slow gain is easier to keep.",
    smallLine:
      'If you have been losing weight without meaning to, it is worth telling your doctor.',
    showsFigures: true,
    teaches: 'Faster is not better.',
  },
  {
    key: 'gain_build',
    name: 'Gain weight + Build muscle',
    paragraph:
      "You've chosen to gain weight and build muscle. Selodía adds a small, steady surplus, about a quarter of a percent of your weight a week, around {surplus} kcal a day, and keeps protein at the top of its range. That helps more of what you gain to be muscle.",
    smallLine:
      'If you have been losing weight without meaning to, it is worth telling your doctor.',
    showsFigures: true,
  },
  {
    key: 'none',
    name: 'No approach chosen',
    paragraph:
      "You haven't chosen an approach yet, so there is no guide yet. Choose one and your guide appears, built around the number above.",
    showsFigures: false,
  },
  {
    key: 'no_weight',
    name: 'Weight not known',
    paragraph:
      "Selodía needs your weight to work out your guide. A guess is fine, and you can add it any time.",
    showsFigures: false,
  },
  {
    key: 'paused',
    name: 'Paused',
    paragraph:
      'Your approach is paused, so Selodía shows what your body uses. Resume when you like and your approach comes back as you set it.',
    showsFigures: true,
  },
];

export const GUIDE_BY_KEY: Record<GuideStateKey, GuideState> = Object.fromEntries(
  GUIDE_STATES.map((g) => [g.key, g])
) as Record<GuideStateKey, GuideState>;

/**
 * Which of the ten she is in.
 *
 * THE ORDER IS THE PRECEDENCE AND IT MATTERS. No weight comes first: without one
 * there is no guide to show whatever she has chosen. Paused comes next, because a
 * pause is a fact about every combination rather than a combination of its own.
 */
export function guideStateFor(input: {
  mode: BodyMode | null;
  paused?: boolean;
  weightKnown?: boolean;
}): GuideState {
  if (input.weightKnown === false) return GUIDE_BY_KEY.no_weight;
  if (input.paused === true) return GUIDE_BY_KEY.paused;

  const m = input.mode;
  const chosen = m && (m.loseFat || m.maintainWeight || m.gainWeight || m.buildMuscle);
  if (!m || !chosen) return GUIDE_BY_KEY.none;

  if (m.loseFat) return m.buildMuscle ? GUIDE_BY_KEY.lose_fat_build : GUIDE_BY_KEY.lose_fat;
  if (m.gainWeight) return m.buildMuscle ? GUIDE_BY_KEY.gain_build : GUIDE_BY_KEY.gain;
  if (m.maintainWeight) return m.buildMuscle ? GUIDE_BY_KEY.maintain_build : GUIDE_BY_KEY.maintain;
  return GUIDE_BY_KEY.build;
}

/** Her braces, filled. Anything not supplied is left as she wrote it. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{([^}]+)\}/g, (whole, name: string) => {
    const v = values[name];
    return v === undefined ? whole : String(v);
  });
}
