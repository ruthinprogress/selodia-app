import { onContraception as isOnContraception } from './life-stage';

// WHAT SHE TOLD THE APP ABOUT PERIODS, PUT IN FRONT OF THE MODEL THAT ANSWERS.
//
// Ruth, 30 September 2026, asking for a menopause knowledge base. This is the
// step before it, and it costs nothing: onboarding Screen 3 has been asking
// nine careful questions and storing three columns - life_stage,
// life_stage_detail, hrt - that the server has never read. A search of app/
// found those names nowhere except red-flags.ts, which is switched off.
//
// So the model that writes every reply has never known whether she is
// perimenopausal, post-menopausal, or taking HRT. The same shape as the Me tab
// fault found this morning: collected, stored, never passed.
//
// FACTS, NOT INSTRUCTIONS, and the distinction is load-bearing here. The blocks
// that carry field names and tool instructions belong to the classify call;
// handing one to the writer is what made it print raw JSON into her message at
// 11:32 today. This block states what she said and what follows from it
// factually - nothing about what to advise, nothing clinical, no guidance.
//
// WHY THE TWO CONSEQUENCE LINES ARE HERE AT ALL. They are not medical advice;
// they are statements about how to READ HER OWN RECORD, and without them the
// model draws the wrong conclusion from data it can see:
//
//   a monthly bleed on sequential HRT is not a natural cycle, which is the
//   stated reason Screen 3 asks about HRT in the first place;
//
//   absent periods do not establish menopause - a coil or a hysterectomy with
//   the ovaries kept means she is still cycling with nothing to bleed. Ruth's
//   rule, from the audit that added the ninth option: never infer menopause
//   status from absent periods.
//
// NOTHING CLINICAL BEYOND THAT. What the menopause is, what HRT does, what any
// of it means for her - that is the reference layer she has asked for, it is
// sourced and cited, and it stays switched off until a clinician has read it.

type LifeStageProfile = {
  life_stage?: string | null;
  life_stage_detail?: string | null;
  hrt?: string | null;
  /** Multi-select, added 30 September: what she is taking, not where she is. */
  hormone_use?: unknown;
};

/**
 * Her answer, in the words the screen used, so nothing is re-labelled.
 *
 * THE OLD KEYS STAY. Her five chips replaced nine on 5 October 2026 and the four
 * kinds of menopause moved behind a follow-up, but a phone still running an
 * earlier bundle writes the old values and the answer it recorded has not
 * changed meaning. A row the app can no longer describe is a row it reads as
 * nothing.
 */
const STAGE_WORDS: Record<string, string> = {
  regular: 'Regular periods',
  // HER OWN ANSWER SINCE 5 OCTOBER, and it is the one the old list could not
  // hold: "Perimenopause - changing or irregular" filed an irregular cycle at
  // twenty-eight as perimenopause.
  irregular: 'Irregular periods',
  perimenopause: 'Perimenopause',
  menopause: 'Menopause',
  no_periods_other: 'No periods, for another reason',
  prefer_not_to_say: 'Preferred not to say',
  // STORED BY EARLIER BUNDLES, described exactly as they were.
  post_menopause: 'Post-menopause - periods stopped naturally',
  surgical: 'Surgical menopause - caused by surgery, with the ovaries removed',
  induced: 'Induced menopause - brought on by medical treatment',
  early: 'Early menopause - before 45',
  not_sure: 'Not sure',
};

/**
 * THE FOLLOW-UP ANSWER, whichever follow-up it came from.
 *
 * ONE MAP FOR BOTH, because both write life_stage_detail and the stage says which
 * question was asked. The keys are distinct on purpose - 'after_treatment' for a
 * menopause brought on by treatment, 'treatment' for periods absent because of
 * it - so a map lookup cannot quietly answer the wrong question.
 */
const DETAIL_WORDS: Record<string, string> = {
  // After "No periods".
  coil: 'a coil or implant',
  hysterectomy_ovaries_kept: 'a hysterectomy with the ovaries kept',
  treatment: 'treatment for something else',
  other: 'something else',
  // After "Menopause". The surgical one keeps the distinction Ruth drew: ovaries
  // removed, which arrives at once rather than over years.
  naturally: 'periods stopped naturally',
  after_surgery: 'after surgery, with the ovaries removed',
  after_treatment: 'brought on by medical treatment',
  before_45: 'before 45',
  not_sure: 'she does not know why',
};

/**
 * The block, or '' when she has told the app nothing.
 *
 * SILENT WHEN SHE DECLINED. "Prefer not to say" is an answer, and the answer is
 * that this is not the app's business - so it is not repeated back to a model
 * on every turn. Nothing is stated about somebody who chose not to state it.
 */
export function lifeStageFacts(profile: LifeStageProfile | null | undefined): string {
  if (!profile) return '';
  const stage = profile.life_stage ?? null;
  const hrt = profile.hrt ?? null;
  const use = Array.isArray(profile.hormone_use)
    ? (profile.hormone_use as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  // THROUGH THE SHARED RULE, not a value name. 'hormonal_contraception' split
  // into 'the_pill' and 'hormonal_coil' on 5 October, and a line reading
  // `includes('hormonal_contraception')` would have gone on answering false for
  // everybody on the pill without failing anywhere.
  const onContraception = isOnContraception(use);
  if (!stage && !hrt && use.length === 0) return '';
  if (stage === 'prefer_not_to_say' && !hrt && use.length === 0) return '';

  const lines: string[] = ['', 'WHERE SHE IS WITH PERIODS, in her own answers:'];

  if (stage && stage !== 'prefer_not_to_say') {
    // THE DETAIL NOW BELONGS TO TWO STAGES. Before 5 October only "No periods"
    // asked a follow-up; Menopause asks one too, and it carries the whole of
    // what the four old chips used to say. Pinning this to one stage would have
    // kept storing her answer and stopped reading it, which is the commonest
    // fault in this repository.
    const asksFollowUp = stage === 'menopause' || stage === 'no_periods_other';
    const detail =
      asksFollowUp && profile.life_stage_detail
        ? ` (${DETAIL_WORDS[profile.life_stage_detail] ?? profile.life_stage_detail})`
        : '';
    lines.push(`- ${STAGE_WORDS[stage] ?? stage}${detail}`);
  }

  if (hrt === 'yes') lines.push('- Taking HRT');
  else if (hrt === 'no' && !onContraception) lines.push('- Not taking HRT');
  if (onContraception) lines.push('- Using hormonal contraception');

  // HOW TO READ HER RECORD, which is the only reason any of this is passed.
  if (hrt === 'yes' || onContraception) {
    // THE SAME SENTENCE FOR BOTH, because it is the same mistake. A withdrawal
    // bleed on the combined pill is no more a natural cycle than a bleed on
    // sequential HRT, and nothing asked about contraception until today.
    const cause = hrt === 'yes' && onContraception
      ? 'the HRT or the contraception'
      : hrt === 'yes'
        ? 'the HRT'
        : 'the contraception';
    lines.push(
      `- So a regular monthly bleed may be ${cause} rather than a natural cycle, and must not be read as one.`
    );
  }
  if (stage === 'no_periods_other' || stage === 'not_sure') {
    lines.push(
      '- No periods does not mean not cycling, and her stage is NOT established. Never state or imply she is menopausal; symptoms are the signal here, not dates.'
    );
  }

  lines.push(
    '- This is what she said about herself, not a diagnosis. Never tell her what stage she is in, and never advise on HRT or any medication - that belongs with her GP.'
  );
  lines.push('');
  return lines.join('\n');
}
