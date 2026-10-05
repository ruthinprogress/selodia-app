// RELATIVE, NOT '@/lib/body-intent'. The server re-exports this file directly
// (app/lib/body-mode.ts) and the Next build resolves no '@/' alias, so an aliased
// import here is a module the server cannot find. body-intent.ts beside it is
// relative for the same reason.
import type { FocusState } from './body-intent';

// FOUR SWITCHES AND ONE PAUSE (Ruth's matrix reply, 4 October 2026).
//
// This replaces the two-switch version from earlier the same evening. The design
// test she set for all of it: low friction, low overwhelm - one tap, quiet by
// default, never ask what the app already knows, describe and never promise or
// score.
//
//   Gain weight      |
//   Maintain weight   >  one weight direction, mutually exclusive
//   Lose fat         |
//   Build muscle ........ independent, combines with any of them or with none
//
// MAINTAIN IS NOW AN EXPLICIT SWITCH, and that is a genuine improvement on my
// version rather than a reversal of it. I had argued maintain should be the
// ABSENCE of both, because a Maintain toggle beside Lose fat would give two ways
// to express one state - the fault in the old chips, where "Lose fat" plus "Less
// fat, more muscle" stored what "Less fat, more muscle" stored alone.
//
// Her answer removes the ambiguity from the other end: all off is NOT maintain,
// it is NOTHING CHOSEN, and nothing chosen has no calorie target at all. So every
// state still has exactly one expression, and the app gains something it has
// needed since 28 September - the ability to tell "she has decided to hold
// steady" from "she has never said", which is the distinction a silent default
// destroyed when it showed three people a maintenance target nobody chose.
//
// ONE PAUSE, NOT A TRAINING PAUSE. Her words: "NO 'Pause training', NO per-row
// paused states. ONE quick Pause: a single tap puts her at maintenance without
// changing her toggles; they stay shown, dimmed; Resume restores them exactly."
//
// So pause is no longer a fact about training, it is a hold on the whole
// arrangement: calories at what she uses, protein at the maintenance range,
// switches untouched and still visible so she can see what she is coming back
// to. One rule for every combination, which is what makes it a single row in the
// matrix rather than a second version of every row.

export type BodyMode = {
  loseFat: boolean;
  maintainWeight: boolean;
  gainWeight: boolean;
  buildMuscle: boolean;
};

export const NO_MODE: BodyMode = {
  loseFat: false,
  maintainWeight: false,
  gainWeight: false,
  buildMuscle: false,
};

/** The three that share one stored value. Only one can be on. */
export const WEIGHT_KEYS = ['loseFat', 'maintainWeight', 'gainWeight'] as const;
export type WeightKey = (typeof WEIGHT_KEYS)[number];

export function isWeightKey(key: keyof BodyMode): key is WeightKey {
  return (WEIGHT_KEYS as readonly string[]).includes(key);
}

/** Nothing chosen at all: no goal, and no calorie figure to show. */
export function isEmpty(mode: BodyMode | null): boolean {
  return !mode || (!mode.loseFat && !mode.maintainWeight && !mode.gainWeight && !mode.buildMuscle);
}

/**
 * Turning a weight switch on turns the other two off.
 *
 * THE UI DIMS, THIS ENFORCES. A disabled control is a courtesy; the rule has to
 * hold in the data as well, because the data is what the figures are read from.
 */
export function withToggle(mode: BodyMode, key: keyof BodyMode, on: boolean): BodyMode {
  const next: BodyMode = { ...mode, [key]: on };
  if (on && isWeightKey(key)) {
    for (const other of WEIGHT_KEYS) if (other !== key) next[other] = false;
  }
  // BUILD MUSCLE STANDS ALONE AGAIN, and now it has to.
  //
  // For a few hours this lit Maintain automatically, to remove an ambiguity two
  // stored columns could not carry. Her final rules make the two states genuinely
  // different - Build alone gets a small surplus, Maintain + Build does not - so
  // merging them would now hide a real distinction rather than a false one.
  //
  // The ambiguity is solved where it belongs instead: body_mode stores exactly
  // what she ticked, and the focus columns are written from it. See the migration
  // the_switches_she_ticked_are_the_record.
  return next;
}

// --------------------------------------------- the four switches, as data
//
// ONE LIST, READ BY BOTH SCREENS. The Today card and the setup question are the
// same four switches with the same rules, and until now that was a promise kept
// by two copies of the same JSX. Two copies is how "Keep things steady" survived
// on one screen after being renamed on the other, and how the chips came to store
// something the toggles could not express.
//
// The labels are hers: "Keep it steady - change that to Maintain my weight."

export const MODE_ORDER: (keyof BodyMode)[] = [
  'loseFat',
  'maintainWeight',
  'gainWeight',
  'buildMuscle',
];

export const MODE_LABEL: Record<keyof BodyMode, string> = {
  loseFat: 'Lose fat',
  maintainWeight: 'Maintain my weight',
  gainWeight: 'Gain weight',
  buildMuscle: 'Build muscle',
};

/** How the one that is on reads in "Not while you are ___". */
const WEIGHT_DOING: Record<WeightKey, string> = {
  loseFat: 'losing fat',
  maintainWeight: 'maintaining',
  gainWeight: 'gaining weight',
};

/**
 * Why a switch is dimmed, or null when it is free to press.
 *
 * SAYING WHY, NOT JUST REFUSING. A control that is dim with no reason reads as
 * broken - her own word for the first version of this card - so the rule that
 * made it dim is the sentence underneath it. Build muscle is never dimmed: it
 * combines with all three and with none.
 */
export function toggleHint(mode: BodyMode, key: keyof BodyMode): string | null {
  if (!isWeightKey(key) || mode[key]) return null;
  const blocking = WEIGHT_KEYS.find((other) => other !== key && mode[other]);
  return blocking ? `Not while you are ${WEIGHT_DOING[blocking]}` : null;
}

/**
 * What the switches store, or null when nothing is chosen.
 *
 * NULL IS THE POINT. Writing maintain/maintain for somebody who has chosen
 * nothing is the silent default that showed three people a figure they never
 * asked for. Build muscle on its own IS a real answer, so it writes maintain on
 * the weight side: she has said what she wants, and what she wants does not move
 * her weight on purpose.
 */
export function focusFromMode(
  mode: BodyMode | null
): { fat: FocusState; muscle: FocusState } | null {
  if (isEmpty(mode) || !mode) return null;
  return {
    fat: mode.loseFat ? 'reduce' : mode.gainWeight ? 'increase' : 'maintain',
    muscle: mode.buildMuscle ? 'increase' : 'maintain',
  };
}

/**
 * The switches, from what is stored. Null means never answered.
 *
 * MAINTAIN CANNOT BE READ FROM THE COLUMNS ALONE: maintain/maintain is what
 * "Maintain weight" writes, and also what "Build muscle" writes on the weight
 * side. It resolves the only way that is true for both - maintain is on when the
 * weight side is held AND she is not building muscle - which round trips every
 * reachable state. check-body-mode.mjs proves it on all of them.
 */
export function modeFromFocus(
  fat: FocusState | null | undefined,
  muscle: FocusState | null | undefined
): BodyMode | null {
  if (!fat || !muscle) return null;
  // A FALLBACK, NOT THE READER. body_mode is the record; this reconstructs a
  // mode from the derived columns for rows written before it existed, and for
  // any caller that only has the two focus values to hand.
  //
  // maintain/increase is the one pair it cannot resolve - Build alone and
  // Maintain + Build both store it - so it returns the one that does NOT add
  // calories. Feeding somebody a surplus they did not ask for is the worse of
  // the two mistakes, and modeFromRecord below never has to guess at all.
  return {
    loseFat: fat === 'reduce',
    gainWeight: fat === 'increase',
    maintainWeight: fat === 'maintain',
    buildMuscle: muscle === 'increase',
  };
}

/**
 * THE RECORD, READ WITHOUT INFERENCE. user_profile.body_mode holds exactly what
 * she ticked, so there is nothing to work out and nothing to lose.
 */
export function modeFromRecord(stored: unknown): BodyMode | null {
  if (!stored || typeof stored !== 'object') return null;
  const o = stored as Record<string, unknown>;
  const mode: BodyMode = {
    loseFat: o.loseFat === true,
    maintainWeight: o.maintainWeight === true,
    gainWeight: o.gainWeight === true,
    buildMuscle: o.buildMuscle === true,
  };
  // A stored contradiction is not trusted: one weight direction, or none.
  const on = WEIGHT_KEYS.filter((k) => mode[k]);
  if (on.length > 1) {
    for (const k of WEIGHT_KEYS) mode[k] = k === on[0];
  }
  return isEmpty(mode) ? null : mode;
}

/** Everything one tap writes: the record, and the two views of it. */
export function modeWrite(mode: BodyMode | null): {
  body_mode: BodyMode | null;
  fat_focus_state: FocusState | null;
  muscle_focus_state: FocusState | null;
} {
  const focus = focusFromMode(mode);
  return {
    body_mode: isEmpty(mode) ? null : mode,
    fat_focus_state: focus?.fat ?? null,
    muscle_focus_state: focus?.muscle ?? null,
  };
}

/**
 * Did she state a weight direction at all?
 *
 * This is the whole of the Build-alone distinction, named for what it means:
 * "build muscle" with nothing said about weight gets the small surplus that
 * building needs; "maintain my weight" with it does not, because she said so.
 */
export function weightDirectionStated(mode: BodyMode | null): boolean {
  return Boolean(mode && WEIGHT_KEYS.some((k) => mode[k]));
}

/**
 * WHAT THIS CARD IS CALLED, AND WHAT IT HOLDS (Ruth, 5 October 2026).
 *
 *   "Change the Card title with the toggles to: 'Current Approach'... You choose
 *   your approach. Selodia provides the guide."
 *
 * The distinction is hers and it is a good one. A GOAL is a thing you are
 * measured against; an APPROACH is what you are doing at the moment, and it can
 * change when life does without anybody having failed. Everything on this card is
 * the second kind: four switches she can move in a second, and a Pause.
 *
 * So the empty state is "Nothing chosen yet" rather than "No goal chosen" - an
 * approach nobody has picked is simply not picked.
 */
export const APPROACH_HEADING = 'Current approach';

export function modeLabel(mode: BodyMode | null): string {
  if (isEmpty(mode) || !mode) return 'Nothing chosen yet';
  if (mode.gainWeight && mode.buildMuscle) return 'Gaining weight and building muscle';
  if (mode.gainWeight) return 'Gaining weight';
  if (mode.loseFat && mode.buildMuscle) return 'Less fat, more muscle';
  if (mode.loseFat) return 'Losing fat';
  if (mode.maintainWeight && mode.buildMuscle) return 'Holding weight, building muscle';
  if (mode.maintainWeight) return 'Maintaining weight';
  return 'Building muscle';
}

/**
 * WHAT HER BODY USES, WHICH IS NEVER CALLED A TARGET (her item 3).
 *
 * Maintenance is an observation about her, not something set for her to hit, and
 * calling it a target is how a number she did not choose starts reading as a test
 * she can fail. Every mode line below is written as a position relative to this
 * one sentence rather than as a figure of its own.
 */
export function usesLine(activityWord: string, tdeeKcal: number): string {
  // "WHEN YOU ARE", NOT "AT" (Ruth, 5 October 2026): "'At' actually isn't good
  // grammar and cheapens the feel."
  //
  // She is right, and the fault was mine for writing the sentence around the
  // link rather than the other way round. "At training once or twice a week" is
  // a preposition doing a job it cannot do - you are not AT a frequency - and it
  // reads like a form field with a value dropped into it, which is exactly the
  // register this app is trying not to have.
  //
  // THE WORDS WERE CHANGED TO SUIT THE SENTENCE, which is the half that makes it
  // work: every activity phrase now follows "When you are" cleanly - mostly
  // sitting, training once or twice a week, training most days. A phrase that
  // only reads after a preposition was a phrase chosen for the wrong sentence.
  return `When you are ${activityWord}, your body uses around ${tdeeKcal.toLocaleString('en-GB')} kcal a day.`;
}

/** The same figure when she has never said how active her weeks are. */
export function usesLineUnset(tdeeKcal: number): string {
  return `Your body uses around ${tdeeKcal.toLocaleString('en-GB')} kcal a day, going on very little movement.`;
}

/**
 * The line under the switches: where today's guide sits against that, and why.
 *
 * DESCRIBES, NEVER PROMISES. No outcome, no date, and no "a choice, not a
 * default" - her design test for all of it.
 *
 * AND IT ASSUMES NOTHING THAT IS NOT ON THE SCREEN (Ruth, 5 October 2026): "the
 * 'What this does' explanation is extremely vague and expects knowledge that is
 * not present on the screen."
 *
 * Every line began "Today's guide sits a little under that" - and on the setup
 * screen there is no "that". The sentence was written for the Today card, where a
 * figure sits directly above it, and then reused on a page where the figure is
 * three sections further down. It says "what your body uses" now, which is true
 * in both places and needs nothing above it.
 *
 * THE RATES ARE NAMED. "A little under, with a floor it will not go below" asks
 * her to take two unexplained quantities on trust; half a percent of bodyweight a
 * week, and never below what she burns lying still, are the actual rules and are
 * no harder to read.
 */
export function modeExplanation(mode: BodyMode | null): string {
  if (isEmpty(mode) || !mode) {
    return 'Nothing chosen yet. Pick what you are working on and your daily guide appears.';
  }
  if (mode.gainWeight && mode.buildMuscle) {
    return 'Your daily guide sits a little above what your body uses - a quarter of a percent of your weight a week, and never more than 300 kcal a day extra. Protein goes to the top of its range, so more of what you gain is muscle rather than fat.';
  }
  if (mode.gainWeight) {
    return 'Your daily guide sits a little above what your body uses - a quarter of a percent of your weight a week, and never more than 300 kcal a day extra. Steady rather than fast, because faster is mostly fat. There is nothing to reach and no date.';
  }
  if (mode.loseFat && mode.buildMuscle) {
    return 'Your daily guide sits at what your body uses, not under it, and protein goes to the top of its range. Asking for less fat AND more muscle at once means the change comes from the protein and the training rather than from eating less.';
  }
  if (mode.loseFat) {
    return 'Your daily guide sits a little below what your body uses - half a percent of your weight a week, which is gentle on purpose. It never drops below what your body burns lying still, whatever the sum says. Protein goes to the top of its range, because that is what protects muscle while you lose fat.';
  }
  if (mode.maintainWeight && mode.buildMuscle) {
    return 'Your daily guide sits at what your body uses, which is what keeps your weight where it is. Protein goes to the top of its range, for recovery and new muscle.';
  }
  if (mode.maintainWeight) {
    return 'Your daily guide sits at what your body uses, which is what keeps your weight where it is.';
  }
  // Build muscle, nothing said about weight: the small surplus building needs.
  return 'Your daily guide sits a little above what your body uses - 5% more, which is the low side on purpose, because fat is easier to gain at this stage of life. Protein goes to the top of its range, for recovery and new muscle.';
}

/**
 * THE SAFETY LINE, SHOWN WHENEVER GAINING WEIGHT IS ON (her item 5).
 *
 * Softened to one sentence at her request. It states a fact of medicine. It does
 * not assess her, does not use the word underweight, mentions no number, and
 * tells her to do nothing - "worth telling your doctor" is as far as an app with
 * no clinician in it can honestly go.
 */
export function modeSafetyLine(mode: BodyMode | null): string | null {
  if (!mode?.gainWeight) return null;
  return 'If you have been losing weight without meaning to, it is worth telling your doctor.';
}

/**
 * The longer wording, behind a small "?" rather than on the card.
 *
 * It belongs in the app, because somebody in recovery deserves to know what this
 * is not. It belongs BEHIND something, because putting eating disorders in front
 * of everybody who taps Gain weight would be the app deciding something about
 * her that it has no way to know.
 */
export function modeSafetyDetail(mode: BodyMode | null): string | null {
  if (!mode?.gainWeight) return null;
  return 'Selodía is not a medical service, and this is not a plan for recovering from an eating disorder - that needs a clinician who knows you. Whatever the reason, this stays gentle: a small surplus, nothing to reach, and no date.';
}

// ---------------------------------------------------------------- the pause

/** The heading on the pause control: what pressing it would do. */
export function pauseToggleLabel(paused: boolean): string {
  return paused ? 'Resume' : 'Pause';
}

export const PAUSE_EXPLANATION =
  'Pause puts everything at what your body uses, without changing what you have chosen. Your switches stay as they are, dimmed, and Resume puts them back exactly. Use it for a holiday, an injury, or any stretch where life gets in the way. Nothing is lost and nothing is counted.';

/** What the card says while paused, in place of the mode line. */
export function pausedLine(activityWord: string, tdeeKcal: number): string {
  return `Paused. ${usesLine(activityWord, tdeeKcal)} Resume puts your goal back exactly as it was.`;
}

// ---------------------------------------------- the activity level, in words
//
// Ruth's decision (B), 4 October 2026: "The activity level counts her usual
// training as one whole-week answer, chosen from plain descriptions, with 'Last
// set on [date]'."
//
// WHY THE WORDING WAS THE BUG. The profile asked "how much you move OUTSIDE
// exercise", and fed the answer to a multiplier that is meant to cover the whole
// day including exercise. Answering honestly about non-exercise movement
// produced a TDEE with her ballet, her training and her 9,847 steps left out -
// which is half of why her maintenance read 1,350 instead of about 1,550.
//
// SO IT IS ONE WHOLE-WEEK ANSWER AND IT SAYS SO. Each line below describes a
// week rather than naming a category, because the labels do not survive contact:
// she called her own week "moderately active" and the figure she expected, 1,551,
// is what this app calls `light`. Nobody should have to guess which word the app
// means - she picks the sentence that matches her week.
//
// NOT DERIVED, EVER AGAIN. It was being recomputed from the cadence chips on a
// screen she walked through, with no guard, so an empty walk wrote 'sedentary'
// over her 'moderate'. It is a stated answer with a date on it now.

export type ActivityChoice = {
  key: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  /** The multiplier on her BMR. */
  factor: number;
  /** One plain line describing a whole week, training included. */
  description: string;
};

export const ACTIVITY_CHOICES: ActivityChoice[] = [
  {
    key: 'sedentary',
    factor: 1.2,
    description: 'Mostly sitting, and no regular training. A desk day with a short walk.',
  },
  {
    key: 'light',
    factor: 1.375,
    description: 'On your feet a fair amount, or training once or twice a week. A class, a swim, a couple of good walks.',
  },
  {
    key: 'moderate',
    factor: 1.55,
    description: 'Training three to five times a week, or a job that keeps you moving most of the day.',
  },
  {
    key: 'active',
    factor: 1.725,
    description: 'Training hard most days, or physical work plus regular training.',
  },
  {
    key: 'very_active',
    factor: 1.9,
    description: 'Training twice a day, or heavy physical work on top of training.',
  },
];

/**
 * WHETHER SHE IS TRAINING, FROM THE WEEK SHE DESCRIBED (Ruth, 5 October 2026).
 *
 *   "yes, remove it. That's all derived from the Today page now with toggles and
 *   a pause button"
 *
 * There used to be a separate switch in the Body Manual - "Whether you are
 * training", with "I am training" and "Paused for now" - and all it did was step
 * protein between the maintenance range and the high one. The activity level now
 * asks the same thing about a usual week, and its lowest option says it outright:
 * "Mostly sitting, and no regular training."
 *
 * TWO CONTROLS FOR ONE FACT, AND THEY COULD CONTRADICT EACH OTHER. She could say
 * she does no regular training and still carry a protein range whose own
 * explanation reads "assumes you are training". That is the shape this codebase
 * keeps paying for, so there is one answer now and it is the one she states.
 *
 * NULL WHEN SHE HAS NOT SAID, which the protein rule reads as training - the
 * behaviour an unanswered question has always had, left alone on purpose. Saying
 * nothing should not quietly lower anybody's protein.
 *
 * THE INJURY CASE, because it is the one worth thinking about: a usual week of
 * three to five sessions, and three weeks off with a bad ankle. The honest move is
 * to change the activity level, because her week HAS changed - and that correctly
 * moves her calories as well as her protein, which the old switch did not.
 */
export function trainingFromActivity(
  activityLevel: string | null | undefined
): 'training' | 'paused' | null {
  if (!activityLevel) return null;
  return activityLevel === 'sedentary' ? 'paused' : 'training';
}

/** "Last set on 4 October", or the line that says it has never been set. */
export function activitySetLine(setAt: string | null | undefined): string {
  if (!setAt) return 'Not set yet.';
  const d = new Date(setAt);
  if (Number.isNaN(d.getTime())) return 'Not set yet.';
  return `Last set on ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.`;
}
