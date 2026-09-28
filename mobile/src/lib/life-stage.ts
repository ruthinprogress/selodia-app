// WHERE SHE IS WITH PERIODS, AND WHAT EACH ANSWER CHANGES.
//
// NINE OPTIONS, AND THE NINTH IS THE POINT. Ruth added it on 28 September 2026
// after the competitor work turned up a Balance reviewer whose surgical
// menopause the app did not reflect, and after the same audit found the case
// neither app handles: a woman with a hormonal coil, or a hysterectomy with her
// ovaries left in, who has no bleeding and is still cycling.
//
// She fits none of the other eight. She would pick "they've stopped" or "not
// sure", and both are wrong in a way that changes how the app reads her weight,
// her symptoms and her whole record. Worse, she is the person for whom symptom
// tracking matters MOST, because symptoms are the only signal she has.
//
// THE RULE FOR HER, in Ruth's words: never infer menopause status from absent
// periods. The stage stays unknown.
//
// SURGICAL MEANS OVARIES REMOVED. That is the distinction Ruth drew, and it is
// the one that matters clinically: menopause caused by surgery arrives at once
// rather than over years, and is typically more intense. A hysterectomy that
// KEEPS the ovaries is not surgical menopause - she is still cycling, with
// nothing to bleed - and belongs under "another reason".

export type LifeStage =
  | 'regular'
  | 'perimenopause'
  | 'post_menopause'
  | 'surgical'
  | 'induced'
  | 'early'
  | 'no_periods_other'
  | 'not_sure'
  | 'prefer_not_to_say';

export type LifeStageOption = {
  key: LifeStage;
  label: string;
  /** The one line under the label, where the label alone would not be clear. */
  hint?: string;
  /** Whether choosing it opens the "which reason?" follow-up. */
  opensReason?: boolean;
};

export const LIFE_STAGES: LifeStageOption[] = [
  { key: 'regular', label: 'Regular periods' },
  { key: 'perimenopause', label: 'Perimenopause', hint: 'Changing or irregular' },
  { key: 'post_menopause', label: 'Post-menopause', hint: 'They stopped naturally' },
  {
    key: 'surgical',
    label: 'Surgical menopause',
    hint: 'Caused by surgery, with the ovaries removed',
  },
  { key: 'induced', label: 'Induced menopause', hint: 'Brought on by medical treatment' },
  { key: 'early', label: 'Early menopause', hint: 'Before 45' },
  {
    key: 'no_periods_other',
    label: "I don't have periods for another reason",
    hint: 'A coil, a hysterectomy, or treatment for something else',
    opensReason: true,
  },
  { key: 'not_sure', label: 'Not sure' },
  { key: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export type NoPeriodsReason = 'coil' | 'hysterectomy_ovaries_kept' | 'treatment' | 'other';

export const NO_PERIODS_REASONS: { key: NoPeriodsReason; label: string; hint?: string }[] = [
  { key: 'coil', label: 'A coil or implant' },
  {
    key: 'hysterectomy_ovaries_kept',
    label: 'A hysterectomy, ovaries kept',
    hint: 'So your hormones still cycle, with nothing to show for it',
  },
  { key: 'treatment', label: 'Treatment for something else' },
  { key: 'other', label: 'Something else' },
];

export type Hrt = 'yes' | 'no' | 'prefer_not_to_say';

export const HRT_OPTIONS: { key: Hrt; label: string }[] = [
  { key: 'yes', label: 'Yes' },
  { key: 'no', label: 'No' },
  { key: 'prefer_not_to_say', label: 'Prefer not to say' },
];

/**
 * Does this answer mean the app should stop counting cycle days?
 *
 * TRUE FOR EVERYTHING EXCEPT A REGULAR CYCLE, and that is the cautious way
 * round. Cycle day and phase are only meaningful when there is a cycle to
 * count, and the failure this prevents is real: a woman five years past her
 * menopause was being told she was on "cycle day 1826, luteal phase", with her
 * weight explained as water retention.
 */
export function hidesCycleDay(stage: LifeStage | null): boolean {
  if (stage === null) return false;
  return stage !== 'regular';
}

/**
 * Does this answer mean period logging should be off?
 *
 * Separate from the question above, because they come apart. Somebody in
 * perimenopause still has periods to log, irregular ones, and turning logging
 * off for her would take away the thing she most needs to record. Somebody with
 * a coil has nothing to log at all.
 */
export function hidesPeriodLogging(stage: LifeStage | null): boolean {
  return (
    stage === 'no_periods_other' ||
    stage === 'post_menopause' ||
    stage === 'surgical' ||
    stage === 'induced'
  );
}

/**
 * A stage the app may reason from, or null when it must not.
 *
 * NO_PERIODS_OTHER RETURNS NULL AND THAT IS THE WHOLE FEATURE. The app knows
 * she has no periods and knows nothing about her menopause status, and those
 * are different facts. Anything that wants to say "because you are
 * post-menopausal" has to ask this first and get an answer.
 */
export function stageForReasoning(stage: LifeStage | null): LifeStage | null {
  if (stage === 'no_periods_other' || stage === 'not_sure' || stage === 'prefer_not_to_say') {
    return null;
  }
  return stage;
}
