import type { MacroKey } from '@/lib/tracked-macros';

// WHERE A FIGURE STANDS, AND THE FOUR WORDS FOR IT.
//
// Ruth, 23 October 2026, on a food log that showed her averages and nothing
// else: "I can't tell that from a glance and that's actually not very good body
// litaracy training... I actually don't think it's a nice to have - it's the
// missing piece that was making it feel pointless and a chore."
//
// THE RULE THIS FILE EXISTS TO HONOUR, written on the server beside the
// guidelines themselves and quoted here because breaking it is easy and quiet:
//
//   "A GUIDELINE IS NOT HER TARGET. The app has real targets, set by her, and
//    daily-targets.ts words them. A population figure is not one of those and
//    must never be read back as 'your target', or she will have acquired a
//    target she never agreed to."
//
// So the artwork's "Target 25-30 g" is right for exactly two of these - the
// calories and protein she set herself - and wrong for the rest. Everything
// else is a published figure for a population, and the screen says GUIDELINE
// and says whose it is. Two words, and the difference between informing her and
// quietly assigning her a goal.
//
// TWO ARE DELIBERATELY NOT COLOURED AT ALL, and that is a feature:
//
//   CARBS has no published daily gram figure. Carbohydrate guidance is a share
//   of energy, not grams, and inventing a number here would look exactly like
//   the real ones beside it.
//
//   SUGAR's published figure is for FREE sugars and the log counts ALL sugar,
//   including what is in whole fruit and milk. Colouring the total against a
//   free-sugar limit would mark almost everybody "higher" for eating fruit.
//   That is worse than silence: it is the app being confidently wrong about
//   something somebody already feels judged on.
//
// A nutrient with nothing honest to say gets no colour and no state. Grey is
// not a failure of the design; it is the design refusing to make something up.

export type Standing = 'in-range' | 'a-little-low' | 'lower' | 'higher';

/**
 * The four numbers that are HERS, as opposed to the eight that are published.
 *
 * IT LIVES IN THIS FILE RATHER THAN BESIDE THE QUERY THAT FILLS IT, and the
 * reason is mechanical: loadNutrientProfile reaches Supabase, which reaches
 * react-native, which cannot be imported by a check running under plain node.
 * Keeping the type and the pure arithmetic here is what lets every band and
 * every boundary below be tested at all - the same split sleep-night.ts needed
 * for the same reason.
 */
export type NutrientProfile = {
  ageYears: number | null;
  targetKcal: number | null;
  proteinLow: number | null;
  proteinHigh: number | null;
};

/** Nobody has weighed and nobody has a birthday: eight tiles still work. */
export const NO_NUTRIENT_PROFILE: NutrientProfile = {
  ageYears: null,
  targetKcal: null,
  proteinLow: null,
  proteinHigh: null,
};

/** Whole years, from a date of birth, or null when there is no usable date. */
export function ageFrom(dateOfBirth: string | null | undefined, now = new Date()): number | null {
  if (!dateOfBirth) return null;
  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) return null;
  let age = now.getFullYear() - born.getFullYear();
  const month = now.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < born.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** How a figure relates to its reference. */
type Shape =
  /** More is the point, up to no particular ceiling: fibre, calcium, iron. */
  | { kind: 'floor'; value: number }
  /** Less is the point: salt, saturated fat, total fat. */
  | { kind: 'ceiling'; value: number }
  /** A band she agreed to: her calories, her protein. */
  | { kind: 'band'; low: number; high: number };

export type Reference = {
  shape: Shape;
  /** "guideline" for a published figure, "target" only for one she set. */
  kind: 'guideline' | 'target';
  /** Whose figure it is. Shown wherever the number is, never omitted. */
  source: string;
  /** How it reads on screen: "30g a day", "no more than 6g of salt". */
  stated: string;
};

/**
 * WHERE "A LITTLE LOW" STOPS AND "LOWER" STARTS.
 *
 * Four-fifths of the reference. It is a chosen line, not a derived one, and it
 * is written here rather than buried in a comparison so that it can be argued
 * with. The reasoning: somebody at 28g of fibre against 30 has essentially hit
 * it and should not be told otherwise; somebody at 12 has not, and a single
 * word for both states would make the word useless.
 */
export const NEARLY = 0.8;

/**
 * The published figures, as numbers.
 *
 * THE PROSE VERSIONS LIVE ON THE SERVER in tracked-macro-summary.ts and are
 * what chat says. These are the same figures as numbers, so a colour and a
 * sentence can never disagree about the same nutrient - and the `stated` string
 * here is deliberately the short form of the server's wording rather than a
 * second opinion.
 */
export function referenceFor(key: MacroKey, profile: NutrientProfile): Reference | null {
  switch (key) {
    case 'kcal':
      return profile.targetKcal
        ? {
            shape: { kind: 'band', low: profile.targetKcal * 0.9, high: profile.targetKcal * 1.1 },
            kind: 'target',
            source: 'your own figure',
            stated: `around ${Math.round(profile.targetKcal).toLocaleString()} kcal a day`,
          }
        : null;

    case 'protein':
      return profile.proteinLow && profile.proteinHigh
        ? {
            shape: { kind: 'band', low: profile.proteinLow, high: profile.proteinHigh },
            kind: 'target',
            source: 'your own figure',
            stated: `${Math.round(profile.proteinLow)}-${Math.round(profile.proteinHigh)}g a day`,
          }
        : null;

    case 'fibre':
      return {
        shape: { kind: 'floor', value: 30 },
        kind: 'guideline',
        source: 'NHS',
        stated: '30g a day for adults',
      };

    case 'calcium':
      return {
        shape: { kind: 'floor', value: 700 },
        kind: 'guideline',
        source: 'NHS',
        stated: '700mg a day for adults',
      };

    // THE SPLIT IS THE POINT, and it is why she asked for iron. The figure
    // nearly halves at the age most of this app's users are near, so one
    // number would be wrong for half of them. Without an age, no colour -
    // guessing which applies is exactly the mistake.
    case 'iron': {
      const age = profile.ageYears;
      if (age == null) return null;
      const value = age > 50 ? 8.7 : 14.8;
      return {
        shape: { kind: 'floor', value },
        kind: 'guideline',
        source: 'NHS',
        stated: age > 50 ? '8.7mg a day for women over 50' : '14.8mg a day for women aged 19 to 50',
      };
    }

    // IN GRAMS OF SALT, WHICH IS NOT WHAT THE COLUMN HOLDS. sodium_mg is the
    // stored figure and macroAmount divides it by 2.5 before anything shows it,
    // because "5.2 g salt" is what somebody reads off a packet and "2,080 mg
    // sodium" is not. So the comparison has to be in the same unit as the
    // figure beside it.
    //
    // THIS WAS WRITTEN AS A 2,400 CEILING FIRST, which took grams of salt and
    // measured them against milligrams of sodium - so a 6 g salt day arrived as
    // the number 2.4 and came back "in range", and salt was the one nutrient on
    // the grid that could never turn. A unit mismatch has no symptom: the tile
    // is the right colour for the wrong reason until somebody checks the sum.
    case 'salt':
      return {
        shape: { kind: 'ceiling', value: 6 },
        kind: 'guideline',
        source: 'NHS',
        stated: 'no more than 6g a day',
      };

    case 'saturated':
      return {
        shape: { kind: 'ceiling', value: 20 },
        kind: 'guideline',
        source: 'NHS',
        stated: 'no more than 20g a day for women',
      };

    case 'fat':
      return {
        shape: { kind: 'ceiling', value: 70 },
        kind: 'guideline',
        source: 'UK reference intake',
        stated: '70g a day for an average adult',
      };

    // See the note at the top. Neither of these has anything honest to compare
    // against, so neither gets a colour.
    case 'carbs':
    case 'sugar':
    default:
      return null;
  }
}

/** Where this figure stands against its reference, or null when nothing does. */
export function standingFor(value: number | null | undefined, ref: Reference | null): Standing | null {
  if (ref == null || value == null || !Number.isFinite(value)) return null;
  const s = ref.shape;

  if (s.kind === 'floor') {
    if (value >= s.value) return 'in-range';
    return value >= s.value * NEARLY ? 'a-little-low' : 'lower';
  }

  if (s.kind === 'ceiling') {
    // NO "A LITTLE HIGH". Her legend has one word for over and two for under,
    // which is not an oversight: for salt and saturated fat the published
    // figure is a ceiling, and being just under it is not a different state
    // from being well under it.
    return value > s.value ? 'higher' : 'in-range';
  }

  if (value > s.high) return 'higher';
  if (value >= s.low) return 'in-range';
  return value >= s.low * NEARLY ? 'a-little-low' : 'lower';
}

/** Her words from the legend, which are the only words for these states. */
export const STANDING_LABEL: Record<Standing, string> = {
  'in-range': 'In range',
  'a-little-low': 'A little low',
  lower: 'Lower',
  higher: 'Higher',
};

/**
 * The line under each word, lifted from her artwork unchanged.
 *
 * Ruth, 24 October 2026: "that whole section in the artwork is lovely and needs
 * to just hide behind an 'i' on the daily average card, top right."
 *
 * LOVELY AND NOT ON THE MAIN SCREEN ARE BOTH TRUE, which is the whole of the
 * instruction. Four states with four sentences is four more sentences on a
 * screen she had already called "not calm", so it lives behind the i - where
 * somebody meeting the colours for the first time will go looking, and nobody
 * else has to read it twice a day.
 */
export const STANDING_NOTE: Record<Standing, string> = {
  'in-range': "You're in a good range.",
  'a-little-low': 'Worth keeping an eye on.',
  lower: 'Could be higher.',
  higher: 'Above the suggested range.',
};

/**
 * The heading and the line behind the i, hers.
 *
 * "WHY COLOUR, NOT DOTS?" IS NOT IN HERE, and was removed on 24 October the day
 * it was added. Ruth: "Remove 'color, not dots' and explainer text beneath as
 * that was just for our own understanding to be recorded."
 *
 * She is right, and the distinction is worth keeping in mind for every screen:
 * that paragraph explains why the DESIGN is the way it is. Nobody using the app
 * asked why it is not dots. A reader needs to know what the colours mean, which
 * is the two lines below; the reasoning behind them is a note for the people
 * building it, and it lives in a comment, which is where this one now is.
 */
export const COLOUR_EXPLAINER = {
  title: "Icon colour shows how you're doing",
  basis: 'Each nutrient is compared to a range based on your goals, age and sex.',
};

/**
 * THE COLOURWAY, CHOSEN BY RUTH ON 23 OCTOBER AND FOR A GOOD REASON.
 *
 * Shown six, she took the one with a SINGLE green: "i associate green with
 * good, reds with bad, so it's a bit confusing to have greens as a little low.
 * I actually think 3 actually feels the most intuitive."
 *
 * That association is not something a palette can argue with. If green appears
 * on two states it is doing two jobs and neither reads. So: one green, meaning
 * one thing, and a warm drift away from it.
 *
 * THE COLOUR SAYS "WORTH A LOOK", NEVER WHICH DIRECTION. Lower and Higher sit
 * close together on purpose - low is the concern for fibre and high is the
 * concern for salt, so neither is universally worse, and the word underneath
 * carries the direction.
 *
 * ALMOST EXACTLY AS SHE DREW THEM, and the reason they could be is hers.
 *
 * The first build put these marks on the sand the cards are made of, where the
 * drawn values measure 2.02 to 2.56 against the 3.0 floor for a mark somebody
 * has to SEE - so I deepened all four, by a lot, and told her the palette had
 * to change. Her answer, 24 October: "If you copy the artwork and have a
 * lighter square inside the Daily average this week square, then you don't have
 * the color problem you invented."
 *
 * She was right. Her artwork draws the grid on a lighter panel INSIDE the card,
 * and on that cream the same four measure 3.26, 2.58, 2.87 and 3.10. The
 * structure fixed what I had been trying to fix with pigment, and the lesson is
 * the general one: a contrast failure is a question about the SURFACE at least
 * as often as about the colour.
 *
 * TWO STILL SIT UNDER THE LINE and are nudged by the smallest amount that
 * clears it - 8% and 3% darker. IN RANGE AND HIGHER ARE UNTOUCHED, exactly as
 * drawn.
 *
 *   in-range      #7C8C6A  unchanged        3.26
 *   a-little-low  #A89684 -> #9A8979   8%   2.58 -> 3.04
 *   lower         #B8865F -> #B3825C   3%   2.87 -> 3.03
 *   higher        #C97458  unchanged        3.10
 *
 * THE MARK IS THE ONLY THING CARRYING THE STATE now, which is why the floor
 * matters more than it did. Her artwork: "Using the icon colour keeps the
 * screen clean and calm, while still giving you an instant visual sense of
 * what's in range." A 1.4px line has to be seen to do that.
 *
 * So each is the drawn colour taken down until it clears 3.0 on sand, and no
 * further:
 *
 *   in-range      #7C8C6A -> #707E5F    a-little-low  #A89684 -> #867769
 *   lower         #B8865F -> #9B7150    higher        #C97458 -> #B0654D
 *
 * Her choice survives intact - one green, then a warm drift away from it, in
 * the same four families and the same order. This is the move theme.ts already
 * made for terracotta ("darkened 35%... unmistakably the same colour family")
 * and health-flower.ts made for all six petals, for the same reason and against
 * the same floor.
 *
 * ONE COLOUR PER STATE, deliberately. Keeping the drawn values alongside these
 * for "where the ground is lighter" would mean two colours meaning one thing,
 * and a legend that matches a tile on one screen and not another.
 *
 * AND THE COLOUR IS NEVER THE ONLY CUE. Every tile carries the word as well as
 * the bar - see nutrient-grid.tsx. A grid that says "you are fine" in green and
 * nothing else says nothing at all to the one reader in twelve who cannot
 * separate these four hues.
 */
export const STANDING_COLOUR: Record<Standing, string> = {
  'in-range': '#7C8C6A',
  'a-little-low': '#9A8979',
  lower: '#B3825C',
  higher: '#C97458',
};

/** The ground the marks are drawn on, so the check measures the real pair. */
export const STANDING_GROUND = '#F7F3EA';
