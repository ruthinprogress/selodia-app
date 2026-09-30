// CALCIUM, SHOWN THE WAY SHE ASKED FOR IT.
//
// Ruth, 30 September 2026: "Do not make this feel like a goal users are
// pressured to hit. It should simply be informative... Avoid red warnings,
// guilt, countdowns, streaks, badges, 'You failed today'."
//
// So this file computes a line and refuses to compute a judgement. There is no
// "short by", no percentage, no colour, and nothing that counts down. The
// reference figure is stated because she asked for it to be, and it is stated
// as what it is - a population reference, not her personal target.
//
// ── THE FIGURE, AND WHERE IT COMES FROM ──────────────────────────────────────
//
// NHS, Vitamins and minerals: Calcium, read 30 September 2026:
//   "Adults aged 19 to 64 and over need 700mg of calcium a day."
// https://www.nhs.uk/conditions/vitamins-and-minerals/calcium/
//
// Her brief says "use the appropriate recommended intake for the user's age,
// sex and country if available". The UK reference for adults is one number, so
// the age and sex branching she anticipated does not exist here yet; when the
// app has users outside the UK it will, and this is the one place it goes.
//
// ── WHAT THIS FILE WILL NOT DO ───────────────────────────────────────────────
//
// It will not say she is low, deficient, or short of anything - that is a
// clinical statement about a person, and a day's estimate from a language model
// is nowhere near good enough to carry it. It will not mention supplements.
// Trends across days, which her brief also asks for, are deliberately not here
// either: a run of low estimates is still a run of ESTIMATES, and the sentence
// that names it has to be written with that in it.

/**
 * The UK reference nutrient intake for adults, in mg a day.
 *
 * NOT A TARGET AND NOT HERS. It is the figure the NHS publishes for adults 19
 * and over, shown so the number beside it means something.
 */
export const UK_CALCIUM_RNI_MG = 700;

export const CALCIUM_SOURCE = {
  name: 'NHS',
  document: 'Vitamins and minerals: Calcium',
  url: 'https://www.nhs.uk/conditions/vitamins-and-minerals/calcium/',
  checked: '2026-09-30',
};

export type CalciumDay = {
  /** What the day's logged items add up to, or null when nothing was estimated. */
  mg: number | null;
  /** The reference beside it. */
  referenceMg: number;
  /** The whole line, ready to show: "Calcium 642 / 700 mg". */
  line: string | null;
  /**
   * True when some of today's items carry no estimate at all, so the figure is
   * a floor rather than a total. Shown as a word, never as an asterisk.
   */
  partial: boolean;
};

export type CalciumItem = { calciumMg: number | null };

/**
 * The day's line.
 *
 * NULL RATHER THAN ZERO when nothing was estimated, and this is the whole care
 * in the file. A day reading "Calcium 0 / 700 mg" says she ate no calcium. A
 * day where the parse simply did not work it out says nothing of the kind, and
 * the two are indistinguishable once a null becomes a 0.
 */
export function calciumDay(items: CalciumItem[]): CalciumDay {
  const stated = items
    .map((i) => i.calciumMg)
    .filter((v): v is number => typeof v === 'number' && v >= 0);

  if (stated.length === 0) {
    return { mg: null, referenceMg: UK_CALCIUM_RNI_MG, line: null, partial: items.length > 0 };
  }

  const mg = Math.round(stated.reduce((s, v) => s + v, 0));
  return {
    mg,
    referenceMg: UK_CALCIUM_RNI_MG,
    line: `Calcium ${mg.toLocaleString()} / ${UK_CALCIUM_RNI_MG} mg`,
    // Some items had a figure and some did not, so the total is a floor.
    partial: stated.length < items.length,
  };
}

/**
 * The one extra word, when the figure is only part of the day.
 *
 * "So far" rather than "incomplete data" or a symbol. It tells her the number
 * can only go up, which is true, and carries no suggestion that she has done
 * anything wrong by logging a food nobody could price.
 */
export function calciumCaveat(day: CalciumDay): string | null {
  if (!day.partial) return null;
  if (day.mg == null) return 'Not worked out for today’s food yet.';
  return 'From the foods that could be estimated, so the real figure is a little higher.';
}
