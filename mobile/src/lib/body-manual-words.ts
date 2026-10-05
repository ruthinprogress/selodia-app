// WHAT HER STORED ANSWERS LOOK LIKE ON THE BODY MANUAL.
//
// Ruth, 5 October 2026: "make the names easy to identify what they hold inside
// on Body Manual, but still on brand."
//
// WHY THE PERIODS ROW NEEDED THIS AT ALL. It was rendering the stored value with
// its underscores swapped for spaces, so her Manual read:
//
//   Periods: no periods other
//
// That is a column name with a haircut. It is also the row most likely to be read
// months or years after it was answered, which is her whole point about the
// headings - and a row that reads like a database field is the one place in the
// app where somebody would doubt whether it had understood her.
//
// THE WORDS COME FROM THE CHIPS SHE TAPPED. Not a second list written here: the
// labels in lib/life-stage.ts, which are the ones she actually read on the screen
// when she answered. A Manual that paraphrases the question is a Manual that can
// disagree with it, and check-body-manual-words.mjs asserts that every value the
// screen can write has a word here.
//
// LEGACY VALUES ARE SPELLED OUT RATHER THAN LOOKED UP, because they are no longer
// in any chip list. Her five period answers replaced nine on 5 October and the
// four kinds of menopause moved behind a follow-up; a phone on an earlier bundle
// can still write the old values, and a row the Manual cannot describe is a row
// it silently shows as nothing.

import {
  HORMONE_USE_OPTIONS,
  LIFE_STAGES,
  MENOPAUSE_KINDS,
  NO_PERIODS_REASONS,
} from '@/lib/life-stage';

/** Her label for a value, from the chip that wrote it. */
function labelsOf(options: readonly { key: string; label: string }[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.key, o.label]));
}

/** Answers no chip offers any more. Described exactly as the chip described them. */
const RETIRED_STAGES: Record<string, string> = {
  post_menopause: 'Post-menopause',
  surgical: 'Surgical menopause',
  induced: 'Induced menopause',
  early: 'Early menopause',
  not_sure: 'Not sure',
};

const RETIRED_HORMONES: Record<string, string> = {
  hormonal_contraception: 'Hormonal contraception',
};

export const STAGE_LABELS: Record<string, string> = {
  ...RETIRED_STAGES,
  ...labelsOf(LIFE_STAGES),
};

/**
 * The follow-up answer, whichever follow-up asked it.
 *
 * ONE MAP FOR BOTH, because both write life_stage_detail and the stage says which
 * question was asked. The keys are distinct by design, so a lookup cannot
 * quietly answer the other question.
 */
export const DETAIL_LABELS: Record<string, string> = {
  ...labelsOf(NO_PERIODS_REASONS),
  ...labelsOf(MENOPAUSE_KINDS),
};

export const HORMONE_LABELS: Record<string, string> = {
  ...RETIRED_HORMONES,
  ...labelsOf(HORMONE_USE_OPTIONS),
};

/**
 * HER PERIODS AND HORMONES, AS LINES ON THE MANUAL, one fact per line.
 *
 * ONE FACT PER LINE IS THE POINT. Her instruction was "a line for each item that
 * is editable", and three answers joined into one string is one line that cannot
 * be acted on. The stage, its detail and each hormone are separate lines.
 *
 * A VALUE WITH NO WORD FOR IT IS SHOWN, NOT DROPPED. The fallback is the stored
 * value itself. It looks wrong, which is correct: a row quietly missing an answer
 * she gave is worse than a row showing one in the app's own vocabulary, and the
 * check makes sure the fallback is never reached by anything the screen can write.
 */
export function bodyLines(profile: {
  life_stage?: string | null;
  life_stage_detail?: string | null;
  hormone_use?: unknown;
}): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const stage = profile.life_stage ?? null;

  if (stage) out.push({ label: 'Periods', value: STAGE_LABELS[stage] ?? stage });

  const detail = profile.life_stage_detail ?? null;
  if (stage && detail) {
    out.push({ label: 'Which', value: DETAIL_LABELS[detail] ?? detail });
  }

  const use = Array.isArray(profile.hormone_use)
    ? (profile.hormone_use as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  for (const u of use) {
    // "NONE" AND "PREFER NOT TO SAY" ARE ANSWERS AND ARE SHOWN. An answered
    // question that renders as nothing reads as an unanswered one, which on this
    // row means the app looks as though it forgot something personal she said.
    out.push({ label: 'Hormones', value: HORMONE_LABELS[u] ?? u });
  }

  return out;
}
