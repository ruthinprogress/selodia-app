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

// ───────────────────────────────────────────────────────────────────────────
// FIVE CHIPS NOW, AND THE DISTINCTIONS KEPT BEHIND ONE (Ruth, 5 October 2026).
//
// Her screen deck names five: "Regular · Irregular · Perimenopause ·
// Menopause · No periods". Nine chips in a column was most of a screen on the
// most personal question in setup, and four of the nine were kinds of one thing.
//
// WHAT HER FIVE WOULD HAVE COST, AND WHY IT DOES NOT. Collapsing post-menopause,
// surgical, induced and early into one "Menopause" would stop the app ever being
// told which it was. Nothing computes on that difference - it is one sentence
// handed to chat - but surgical menopause arrives at once rather than over years
// and is a different thing to live with, so losing it to save a tap is a bad
// trade.
//
// SO IT USES THE PATTERN SHE INVENTED. Her own ninth option, added 28 September,
// opens a short follow-up rather than carrying its answer in the chip. Menopause
// now does the same: one tap, then which kind. Five chips on the screen, every
// distinction still in the record.
//
// AND "IRREGULAR" IS A FIX, NOT A SIMPLIFICATION. "Perimenopause - changing or
// irregular" put the two under one word, so an irregular cycle at twenty-eight
// had to be filed as perimenopause. It is its own answer now, and it is the one
// answer in the set that keeps period logging ON while turning cycle day off.
//
// NOT_SURE IS GONE FROM THE CHIPS, because "Irregular" is what most of the
// people picking it actually meant, and "Prefer not to say" is what the rest
// meant. It stays in the type: a phone still running yesterday's bundle can
// write it, and a value the app can store is a value the app has to be able to
// read.

export type LifeStage =
  // HERS, IN HER ORDER.
  | 'regular'
  | 'irregular'
  | 'perimenopause'
  | 'menopause'
  | 'no_periods_other'
  | 'prefer_not_to_say'
  // STORED BY EARLIER BUNDLES, never offered again. Read, displayed and reasoned
  // from exactly as before: nobody's answer stops meaning what it meant because
  // the screen that asked it changed.
  | 'post_menopause'
  | 'surgical'
  | 'induced'
  | 'early'
  | 'not_sure';

/** What the screen offers today. The rest of LifeStage is history. */
export const CURRENT_STAGES: LifeStage[] = [
  'regular',
  'irregular',
  'perimenopause',
  'menopause',
  'no_periods_other',
  'prefer_not_to_say',
];

export type LifeStageOption = {
  key: LifeStage;
  label: string;
  /** The one line under the label, where the label alone would not be clear. */
  hint?: string;
  /** Whether choosing it opens the "which reason?" follow-up. */
  opensReason?: boolean;
};

/**
 * HER FIVE, PLUS THE ONE SHE KEPT.
 *
 * NO HINTS ON ANY OF THEM, WHICH IS WHAT MAKES IT TWO ROWS. A hint takes the
 * whole width - see lib/chip-layout.ts - so nine hinted chips were nine rows.
 * The two that need more than a word ask a follow-up instead, which is both
 * shorter on the screen and more exact in the record.
 *
 * "PREFER NOT TO SAY" IS NOT IN HER FIVE AND STAYS ANYWAY. This is the screen it
 * exists for. Her own closing line says the whole thing is optional, and a
 * question that is optional in its subtitle and unanswerable in its options is
 * not optional.
 */
export const LIFE_STAGES: LifeStageOption[] = [
  { key: 'regular', label: 'Regular' },
  { key: 'irregular', label: 'Irregular' },
  { key: 'perimenopause', label: 'Perimenopause' },
  { key: 'menopause', label: 'Menopause', opensReason: true },
  { key: 'no_periods_other', label: 'No periods', opensReason: true },
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

/**
 * WHICH KIND OF MENOPAUSE, asked only after she taps Menopause.
 *
 * THESE ARE THE FOUR CHIPS THAT USED TO BE ON THE SCREEN, moved one tap back
 * rather than deleted. Nothing in the app computes on the difference: it is one
 * sentence in what chat is told, which is exactly what it was before. What would
 * have been lost is the sentence.
 *
 * SURGERY MEANS THE OVARIES WERE REMOVED, and that hint stays whatever it costs
 * in width. It is the distinction Ruth drew on 28 September and the one that
 * matters: menopause caused by surgery arrives at once rather than over years. A
 * hysterectomy that KEEPS the ovaries is not this - she is still cycling with
 * nothing to bleed - and belongs under "No periods".
 *
 * NOT_SURE BELONGS HERE RATHER THAN IN THE STAGES. "I know my periods have
 * stopped and I don't know why" is a real and ordinary answer. It was
 * unanswerable before: the old "Not sure" chip sat beside the stages and meant
 * "I don't know where I am", which is a different sentence.
 */
export type MenopauseKind =
  | 'naturally'
  | 'after_surgery'
  | 'after_treatment'
  | 'before_45'
  | 'not_sure';

export const MENOPAUSE_KINDS: { key: MenopauseKind; label: string; hint?: string }[] = [
  { key: 'naturally', label: 'Naturally' },
  { key: 'after_surgery', label: 'After surgery', hint: 'With the ovaries removed' },
  { key: 'after_treatment', label: 'After treatment' },
  { key: 'before_45', label: 'Before 45' },
  { key: 'not_sure', label: 'Not sure' },
];

/**
 * The follow-up a stage opens, or null where it opens none.
 *
 * ONE FUNCTION, SO THE SCREEN HAS ONE BRANCH. Two stages ask a second question
 * and both write the same column, so a screen that handles them separately is two
 * copies of one thing - and the kind of place where the second copy is added
 * later and forgotten. `opensReason` on the option and this function are the same
 * fact, and assertFollowUpsMatch below fails the build if they disagree.
 */
export function followUpFor(
  stage: LifeStage | null
): { options: { key: string; label: string; hint?: string }[] } | null {
  if (stage === 'menopause') return { options: MENOPAUSE_KINDS };
  if (stage === 'no_periods_other') return { options: NO_PERIODS_REASONS };
  return null;
}

/**
 * THE TWO LISTS CANNOT DISAGREE, and this is the cheapest version of a guard this
 * project has needed four times: the chip says it opens a follow-up, and the
 * function says what the follow-up is. One without the other is a dead end on the
 * most personal screen in setup, and nothing would throw.
 */
function assertFollowUpsMatch() {
  for (const option of LIFE_STAGES) {
    const has = followUpFor(option.key) !== null;
    if (Boolean(option.opensReason) !== has) {
      throw new Error(
        `"${option.label}" says opensReason=${Boolean(option.opensReason)} and followUpFor says ${has}.`
      );
    }
  }
}
assertFollowUpsMatch();

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
  // IRREGULAR IS COVERED BY THIS BEING EVERYTHING-BUT-REGULAR, which is the
  // whole point of writing it that way round: a new answer is cautious by
  // default rather than cautious only if somebody remembers to add it. A cycle
  // that is irregular cannot be counted in days; it can still be logged, which
  // is the next function down and where irregular differs from menopause.
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
    // HER SINGLE MENOPAUSE CHIP, which covers all four of the old ones. 'early'
    // was missing from this list and should not have been: periods that stopped
    // before 45 have still stopped, and a log for something that does not happen
    // is a log nobody can fill in.
    stage === 'menopause' ||
    stage === 'post_menopause' ||
    stage === 'surgical' ||
    stage === 'induced' ||
    stage === 'early'
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
  | 'hrt'
  | 'the_pill'
  | 'hormonal_coil'
  | 'neither'
  | 'prefer_not_to_say'
  /** Stored by bundles before 5 October 2026. Read, never offered. */
  | 'hormonal_contraception';

/**
 * HER FOUR, IN HER WORDS (5 October 2026): "HRT · The pill · Coil · None".
 *
 * BECAUSE NOBODY SAYS "HORMONAL CONTRACEPTION". They say the pill, or the coil.
 * One chip reading "Hormonal contraception / The pill, a coil, an implant, an
 * injection" is the app's filing category with her vocabulary as a footnote.
 *
 * AND "COIL" ON ITS OWN WOULD RECORD A HORMONE THAT IS NOT THERE. A copper coil
 * is not hormonal. Her label with that one word added is the version that stays
 * true: a woman with a copper coil taps nothing here, which is correct, because
 * there is nothing for the app to allow for.
 *
 * THE IMPLANT AND THE INJECTION GO UNDER THE PILL'S HINT rather than getting
 * chips of their own. What the app does with any of them is identical - a bleed
 * on them is not a natural cycle - so the distinction would be filing rather
 * than meaning.
 */
export const HORMONE_USE_OPTIONS: { key: HormoneUse; label: string; hint?: string }[] = [
  { key: 'hrt', label: 'HRT' },
  { key: 'the_pill', label: 'The pill', hint: 'Or an implant, or an injection' },
  { key: 'hormonal_coil', label: 'Hormonal coil', hint: 'A copper coil is not hormonal' },
  { key: 'neither', label: 'None' },
  { key: 'prefer_not_to_say', label: 'Prefer not to say' },
];

/**
 * Anything that makes a bleed something other than a natural cycle.
 *
 * ONE PLACE, because this is the question every reader of hormone_use is actually
 * asking, and it used to be asked as `use.includes('hormonal_contraception')` at
 * each call site. Splitting one value into two would have left every one of those
 * silently answering false for somebody on the pill.
 */
export const CONTRACEPTION_VALUES: HormoneUse[] = [
  'the_pill',
  'hormonal_coil',
  // STORED BY EARLIER BUNDLES. A phone still on yesterday's bundle writes this,
  // and the answer it recorded has not changed meaning.
  'hormonal_contraception',
];

export function onContraception(use: readonly string[]): boolean {
  return use.some((u) => (CONTRACEPTION_VALUES as string[]).includes(u));
}

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
  // THROUGH onContraception, NOT THE RAW VALUE. When 'hormonal_contraception'
  // split into 'the_pill' and 'hormonal_coil' on 5 October, this line would have
  // quietly started answering false for everybody on the pill - which is the
  // single most useful thing the whole question buys, and nothing would have
  // thrown. One list of what counts, read by every caller.
  return use.includes('hrt') || onContraception(use);
}
