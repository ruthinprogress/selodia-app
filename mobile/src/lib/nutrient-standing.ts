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
  /**
   * Whether she is still having periods, where the app has been told.
   *
   * ONLY THE IRON FIGURE USES THIS, and only after 50. null means "not told",
   * which is a third answer and not the same as false - see the iron case.
   */
  stillBleeding: boolean | null;
};

/** Nobody has weighed and nobody has a birthday: eight tiles still work. */
export const NO_NUTRIENT_PROFILE: NutrientProfile = {
  ageYears: null,
  targetKcal: null,
  proteinLow: null,
  proteinHigh: null,
  stillBleeding: null,
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
/**
 * ENERGY SCALES; MASS DOES NOT. THE RESEARCH, AND WHY IT CHANGED THE FIGURES.
 *
 * Ruth, 24 October 2026: "All nutrients should have the correct figure for
 * women in the range of the age that is actually recorded for the user. If
 * this needs a research task, then let's do it properly."
 *
 * It did, and the research moved four of the ten. The finding that matters:
 *
 *   THE FAMILIAR GRAM FIGURES ARE THE PERCENTAGES, ALREADY APPLIED TO SOMEBODY
 *   ELSE. "70g of fat, 20g of saturates, 260g of carbohydrate" are the UK
 *   label Reference Intakes, and the guidance that sets them says in terms that
 *   they are "based on an average sized woman doing an average amount of
 *   physical activity" eating 2,000 kcal. They are not a separate kind of
 *   advice from the percentage; they are one arithmetic step past it.
 *
 * So a woman eating 1,560 kcal who keeps to 20g of saturated fat is at 11.5% of
 * her energy, which is OVER the 10% ceiling, while a tile built on the flat
 * figure tells her she is fine. The same error, smaller, runs through fat,
 * carbohydrate and free sugars. Scaling to her own energy target is not a
 * refinement here - it is the figure the guidance actually states.
 *
 * WHAT DOES NOT SCALE, and these were checked rather than assumed:
 *
 *   FIBRE 30g     SACN 2015 sets it as an absolute for adults 17 and over, not
 *                 as a share of energy. It stays 30g whatever she eats.
 *   SALT 6g       An absolute for adults.
 *   CALCIUM 700mg The UK RNI for adults 19 and over, with no sex split and no
 *                 post-menopausal increase - unlike several other countries.
 *   IRON          Not energy at all: 14.8mg for women 19-49 and 8.7mg from 50,
 *                 and see the note on that case, because the cliff is softer
 *                 than a birthday.
 *
 * EVERY FIGURE BELOW IS IN citations.ts WITH THE PAGE IT CAME FROM AND THE DATE
 * IT WAS READ. Nothing here is recalled.
 */

/** Energy per gram, for turning a share of energy into a weight of food. */
const KCAL_PER_G = { fat: 9, carb: 4 } as const;

/** A share of her energy target, as grams, rounded to something sayable. */
function shareOfEnergy(targetKcal: number, share: number, perGram: number): number {
  const grams = (targetKcal * share) / perGram;
  return Math.round(grams * 10) / 10;
}

export function referenceFor(key: MacroKey, profile: NutrientProfile): Reference | null {
  const energy = profile.targetKcal;

  switch (key) {
    case 'kcal':
      return energy
        ? {
            shape: { kind: 'band', low: energy * 0.9, high: energy * 1.1 },
            kind: 'target',
            // "YOUR OWN" COMPLETES THE SENTENCE the label builds, rather than
            // half of it: with 'your own figure' it read "your own figure
            // target" on her phone.
            source: 'your own',
            stated: `around ${Math.round(energy).toLocaleString()} kcal a day`,
          }
        : null;

    case 'protein':
      return profile.proteinLow && profile.proteinHigh
        ? {
            shape: { kind: 'band', low: profile.proteinLow, high: profile.proteinHigh },
            kind: 'target',
            source: 'your own',
            stated: `${Math.round(profile.proteinLow)}-${Math.round(profile.proteinHigh)}g a day`,
          }
        : null;

    // NO MORE THAN 10% OF FOOD ENERGY (SACN 2019). The NHS states it as 20g for
    // women, which is that 10% at 2,000 kcal.
    case 'saturated': {
      if (!energy) return null;
      const value = shareOfEnergy(energy, 0.1, KCAL_PER_G.fat);
      return {
        shape: { kind: 'ceiling', value },
        kind: 'guideline',
        source: 'SACN, scaled to your energy',
        stated: `no more than ${value}g a day, which is 10% of your energy`,
      };
    }

    // NO MORE THAN 35% OF FOOD ENERGY. The label's 70g is that share at
    // 2,000 kcal.
    case 'fat': {
      if (!energy) return null;
      const value = shareOfEnergy(energy, 0.35, KCAL_PER_G.fat);
      return {
        shape: { kind: 'ceiling', value },
        kind: 'guideline',
        source: 'UK DRV, scaled to your energy',
        stated: `no more than ${value}g a day, which is 35% of your energy`,
      };
    }

    // AROUND 50% OF TOTAL DIETARY ENERGY (SACN 2015). The label's 260g is that
    // share at 2,000 kcal.
    //
    // A BAND, NOT A FLOOR, AND DELIBERATELY WIDE. SACN sets this as a
    // population average, and plenty of women eat deliberately below it for
    // reasons that are theirs. Scoring somebody "Lower" for that would be the
    // app taking a side in an argument it has no business in - so the band runs
    // from two thirds of the figure to a third above it, and only a day well
    // outside that says anything at all.
    case 'carbs': {
      if (!energy) return null;
      const mid = shareOfEnergy(energy, 0.5, KCAL_PER_G.carb);
      return {
        shape: { kind: 'band', low: Math.round(mid * 0.66), high: Math.round(mid * 1.33) },
        kind: 'guideline',
        source: 'SACN, scaled to your energy',
        stated: `around ${Math.round(mid)}g a day, which is 50% of your energy`,
      };
    }

    // NO MORE THAN 5% OF ENERGY (SACN 2015). The NHS states 30g a day for
    // adults, which is that 5% at 2,000 kcal.
    case 'freeSugar': {
      if (!energy) return null;
      const value = shareOfEnergy(energy, 0.05, KCAL_PER_G.carb);
      return {
        shape: { kind: 'ceiling', value },
        kind: 'guideline',
        source: 'SACN, scaled to your energy',
        stated: `no more than ${value}g a day, which is 5% of your energy`,
      };
    }

    // AN ABSOLUTE, and checked to be sure: SACN 2015 sets 30g for adults aged
    // 17 and over, not a share of energy.
    case 'fibre':
      return {
        shape: { kind: 'floor', value: 30 },
        kind: 'guideline',
        source: 'SACN',
        stated: '30g a day for adults',
      };

    // 700mg for adults 19 and over. The UK does NOT raise this after the
    // menopause, which several other countries do - so it is one figure, and
    // inventing an age split here would be inventing guidance.
    case 'calcium':
      return {
        shape: { kind: 'floor', value: 700 },
        kind: 'guideline',
        source: 'NHS',
        stated: '700mg a day for adults',
      };

    // THE AGE SPLIT IS REAL AND THE CLIFF IS NOT (checked 24 October 2026).
    //
    // The NHS gives 14.8mg for women aged 19 to 49 and 8.7mg from 50 - and adds
    // that women who are still menstruating after 50 may need the higher
    // figure. The first version of this dropped everybody over 50 to 8.7 on
    // their birthday, which is the app quietly deciding somebody's periods have
    // stopped.
    //
    // It no longer decides. `stillBleeding` comes from what she has actually
    // recorded - her life stage, and whether the app has seen a period - and
    // where that says nothing, the higher figure stands, because under-stating
    // iron for a woman who is still losing it monthly is the costlier mistake
    // of the two.
    case 'iron': {
      const age = profile.ageYears;
      if (age == null) return null;
      const lower = age >= 50 && profile.stillBleeding === false;
      return {
        shape: { kind: 'floor', value: lower ? 8.7 : 14.8 },
        kind: 'guideline',
        source: 'NHS',
        stated: lower
          ? '8.7mg a day for women 50 and over'
          : age >= 50
            ? '14.8mg a day, the figure for women still having periods'
            : '14.8mg a day for women aged 19 to 49',
      };
    }

    // IN GRAMS OF SALT, WHICH IS NOT WHAT THE COLUMN HOLDS. sodium_mg is the
    // stored figure and macroAmount divides it by 400 before anything shows it,
    // because "5.2 g salt" is what somebody reads off a packet and "2,080 mg
    // sodium" is not.
    //
    // THIS WAS WRITTEN AS A 2,400 CEILING FIRST, which took grams of salt and
    // measured them against milligrams of sodium - so a 6 g salt day arrived as
    // the number 2.4 and came back "in range", and salt was the one nutrient on
    // the grid that could never turn. A unit mismatch has no symptom.
    case 'salt':
      return {
        shape: { kind: 'ceiling', value: 6 },
        kind: 'guideline',
        source: 'NHS',
        stated: 'no more than 6g a day',
      };

    // TOTAL SUGAR STILL HAS NOTHING TO COMPARE AGAINST, and that is unchanged
    // by the research. The published limit is for FREE sugars; this column is
    // all sugar, including the sugar inside whole fruit and the lactose in
    // milk. Colouring the total against a free-sugar limit would mark almost
    // everybody "higher" for eating fruit.
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
