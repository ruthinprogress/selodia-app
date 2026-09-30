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

// ── WHAT SHE IS TAKING, WHICH IS NOT WHERE SHE IS ───────────────────────────
//
// Added 30 September 2026. Ruth's Body Manual draft listed hormonal
// contraception and HRT among the stages; they are interventions and they
// combine with a stage rather than replacing it. Perimenopausal AND on HRT is
// the ordinary case in this audience.
//
// AND ASKING ABOUT CONTRACEPTION CLOSES A REAL GAP. The app has always asked
// about HRT so "a monthly bleed on sequential HRT is not read as a cycle". The
// same is true of the combined pill and nothing has ever asked: a withdrawal
// bleed is not a natural cycle. A woman on the pill answers "regular periods",
// which is true as she experiences it, and every bleed is then read as evidence
// of a cycle the app can reason from.

export type HormoneUse =
  | 'hormonal_contraception'
  | 'hrt'
  | 'neither'
  | 'prefer_not_to_say';

export const HORMONE_USE_OPTIONS: { key: HormoneUse; label: string; hint?: string }[] = [
  {
    key: 'hormonal_contraception',
    label: 'Hormonal contraception',
    hint: 'The pill, a coil, an implant, an injection',
  },
  { key: 'hrt', label: 'HRT' },
  { key: 'neither', label: 'Neither' },
  { key: 'prefer_not_to_say', label: 'Prefer not to say' },
];

/** These two answer the whole question, so they clear everything else. */
const EXCLUSIVE: HormoneUse[] = ['neither', 'prefer_not_to_say'];

/**
 * Toggling one answer, with the exclusivity handled here rather than in the
 * screen - so the rule is testable and there is one of it.
 */
export function toggleHormoneUse(current: HormoneUse[], key: HormoneUse): HormoneUse[] {
  if (current.includes(key)) return current.filter((k) => k !== key);
  if (EXCLUSIVE.includes(key)) return [key];
  return [...current.filter((k) => !EXCLUSIVE.includes(k)), key];
}

/** Kept in step so everything written before this column keeps working. */
export function hrtFromHormoneUse(use: HormoneUse[]): Hrt | null {
  if (use.includes('hrt')) return 'yes';
  if (use.includes('prefer_not_to_say')) return 'prefer_not_to_say';
  if (use.includes('neither') || use.length > 0) return 'no';
  return null;
}

/**
 * IS A BLEED EVIDENCE OF A NATURAL CYCLE?
 *
 * No, on sequential HRT, and no on hormonal contraception. This is the single
 * most useful thing the question buys, and it is the reason to ask it of
 * everybody rather than only of women whose periods have changed.
 */
export function bleedMayNotBeACycle(use: HormoneUse[]): boolean {
  return use.includes('hrt') || use.includes('hormonal_contraception');
}
