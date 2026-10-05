// WHAT SHE WANTS HER BODY TO DO, AND HOW THAT BECOMES A NUMBER.
//
// Ruth, 2 October 2026: "Support four intents: lose fat (moderate deficit with a
// floor), recomposition (around maintenance, higher protein), build muscle
// (small surplus), stay as I am. Show her the figures and how they were worked
// out before saving."
//
// RECOMPOSITION WAS NOT REACHABLE, AND IT IS HER OWN GOAL. The arithmetic has
// supported it since August - fat reduce with muscle increase returns a
// maintenance target flagged isRecomposition - but no tap produced that pair.
// She would have had to choose "Lose fat" AND "Build muscle" and know that the
// combination meant something. Her stated goal is the same weight with less fat
// and more muscle, and there was no way to say it.
//
// A FLOOR ON THE DEFICIT, which there was not. The deficit is 0.5% of bodyweight
// a week, and for a small woman that can land under what she needs to function:
// nothing stopped the figure going below her own BMR. The floor is the higher of
// her BMR and 1200, and when it bites she is told the figure was raised and why,
// because a target quietly clamped is a target whose basis she cannot see.
//
// THE EXPLANATION IS NOT DECORATION. "Show her the figures and how they were
// worked out BEFORE saving" is the requirement, and the reason is the one that
// runs through this whole app: a number with no visible basis is something to be
// obeyed or failed, and a number she watched being built is a tool. It also
// catches a wrong input - a weight typed in pounds into a kg box shows up
// immediately as a strange BMR, which no amount of validation would have caught
// as reliably as her reading it.
//
// NO TARGET WEIGHT AND NO DEADLINE, anywhere in this file. Her instruction, and
// the reason there is no "by when" and no goal figure in any of the lines below.

// THE SENTENCES LIVE IN ONE PLACE (Ruth, 5 October 2026): "Store the sentences in
// the matrix so Today and the Body Manual reuse them." body-mode.ts holds them,
// and this panel reads them rather than keeping a second copy.
//
// NO CYCLE: body-mode's only import from here is `import type`, which is erased
// at build time, so there is no runtime edge back.
import type { BodyMode } from './body-mode';
import { GUIDE_FRAME, fill, guideStateFor } from './starting-guide';

export type FocusState = 'reduce' | 'maintain' | 'increase';

export type BodyIntentKey =
  | 'lose_fat'
  | 'recomposition'
  | 'build_muscle'
  | 'stay_as_i_am'
  | 'gain_weight'
  | 'gain_and_muscle';

export type BodyIntent = {
  key: BodyIntentKey;
  /** What she taps. */
  label: string;
  /** The one line under it, in plain words. No numbers, no shame. */
  note: string;
  fat: FocusState;
  muscle: FocusState;
  /** Recomposition and muscle gain both want protein at the top of the range. */
  highProtein: boolean;
};

export const BODY_INTENTS: BodyIntent[] = [
  {
    key: 'lose_fat',
    label: 'Lose fat',
    note: 'A gentle deficit, with a floor it will not go under.',
    fat: 'reduce',
    muscle: 'maintain',
    highProtein: false,
  },
  {
    key: 'recomposition',
    label: 'Less fat, more muscle',
    // HER OWN WORDS FOR IT, from the brief: "same weight, less fat, more
    // muscle". The label avoids "recomposition" because the screen is read by
    // somebody who wants an outcome, not a term.
    note: 'About the same weight, with the shape changing. Eating around what you use, protein high.',
    fat: 'reduce',
    muscle: 'increase',
    highProtein: true,
  },
  {
    key: 'build_muscle',
    label: 'Build muscle',
    // NO LONGER A SURPLUS (4 October 2026, her decision A). Building muscle at
    // the weight she is now is recomposition, and it needs the protein rather
    // than extra calories. Only Gain weight adds any.
    note: 'Eating around what you use, with protein high.',
    fat: 'maintain',
    muscle: 'increase',
    highProtein: true,
  },
  // GAINING WEIGHT NEEDS CARE THE OTHERS DO NOT (Ruth, 4 October 2026).
  //
  //   "A capped surplus. It's modest and steady, never aggressive, whatever
  //   someone types. A calm line about unintended weight loss... No pressure. No
  //   target weight, no deadline, and no 'you are underweight' label from the
  //   app. Handle eating-disorder recovery with care. Someone in recovery needs
  //   a clinician's plan. The app shouldn't act as their coach."
  //
  // WHY THE SURPLUS IS ALREADY SAFE, and stays that way by being a constant.
  // SURPLUS_KCAL is 150 in code, in both mirrors, and nothing anywhere lets a
  // number be typed into it - the only lever is which focus is set. So "capped
  // whatever someone types" is a property of the shape rather than a limit that
  // has to be enforced, and check-gain-weight.mjs asserts it stays one.
  //
  // NO FIGURE AND NO DATE, EVER. The weight question offers a number to WRITE
  // DOWN, never one to count towards, and nothing here produces a target weight
  // or a rate. A gentle surplus with no finish line is the whole design: the
  // failure mode for everything else in this app is a woman feeling behind, and
  // for this one it is considerably worse than that.
  //
  // THE APP DOES NOT NAME HER BODY. There is no "underweight", no BMI band, no
  // assessment of any kind - only what she asked for and what that does to the
  // figures. A label is a judgement, and a judgement here is a clinician's.
  {
    key: 'gain_weight',
    label: 'Gain weight',
    note: 'A small, steady surplus. Nothing aggressive, and nothing to hit.',
    fat: 'increase',
    muscle: 'maintain',
    highProtein: false,
  },
  {
    key: 'gain_and_muscle',
    label: 'Gain weight and build muscle',
    note: 'A gentle surplus scaled to your weight, with protein high so more of it is muscle.',
    fat: 'increase',
    muscle: 'increase',
    highProtein: true,
  },
  {
    key: 'stay_as_i_am',
    label: 'Stay as I am',
    note: 'Eating around what you use. A choice, not a default.',
    fat: 'maintain',
    muscle: 'maintain',
    highProtein: false,
  },
];

export const BODY_INTENT_BY_KEY: Record<BodyIntentKey, BodyIntent> = Object.fromEntries(
  BODY_INTENTS.map((i) => [i.key, i])
) as Record<BodyIntentKey, BodyIntent>;

/** Which intent a stored focus pair means, or null when nothing was stated. */
export function intentFromFocus(
  fat: FocusState | null | undefined,
  muscle: FocusState | null | undefined
): BodyIntent | null {
  if (!fat || !muscle) return null;
  return BODY_INTENTS.find((i) => i.fat === fat && i.muscle === muscle) ?? null;
}

// ---------------------------------------------------------------- the floor

/**
 * THE LOWEST A CALORIE TARGET MAY GO.
 *
 * Her BMR is what her body uses lying still; eating under it as a standing
 * arrangement is not a gentler version of a deficit, it is a different thing.
 * 1200 is the conventional absolute minimum for an adult woman and catches the
 * case where a BMR estimate itself comes out implausibly low.
 *
 * THE HIGHER OF THE TWO, so neither can be the loophole.
 */
export const ABSOLUTE_FLOOR_KCAL = 1200;

// MOVED HERE FROM calorie-target.ts (4 October 2026) to break a cycle:
// calorie-target already imports calorieFloor from this file, so the gain
// rule lives beside the floor rather than importing backwards.
const GAIN_KCAL_PER_KG = 7700;
// 0.25% of bodyweight a week - half the fat-loss rate, which is the right order
// for gaining, and gentle on purpose. Faster is mostly fat and harder to keep.
const WEEKLY_GAIN_FRACTION = 0.0025;
// Building muscle with no weight direction stated: 5% of what she uses. Low on
// purpose - fat is easier to gain than muscle at this stage of life, and the
// cost of being slightly under is slower progress rather than fat gained.
//
// A PERCENTAGE OF TDEE, NOT OF BODYWEIGHT, and the difference is deliberate:
// what building costs tracks what she already burns. The gain-weight surplus is
// scaled to bodyweight instead, because gaining weight is about the body being
// added to.
export const BUILD_SURPLUS_FRACTION = 0.05;
// The ceiling, stated rather than implied. It binds above about 109 kg, so for
// almost everybody the scaled figure is what applies; it exists so that scaling
// can never become a reason the number keeps growing.
const SURPLUS_CEILING_KCAL = 300;
const SURPLUS_FLOOR_KCAL = 100;

/** The daily surplus for gaining weight: scaled, capped, and never typed in. */
export function gainSurplusKcal(weightKg: number): number {
  const daily = Math.round((WEEKLY_GAIN_FRACTION * weightKg * GAIN_KCAL_PER_KG) / 7);
  // BOTH BOUNDS STATED. The ceiling binds above about 109 kg so that scaling can
  // never become a reason the number keeps growing; the floor binds below about
  // 36 kg so the surplus stays large enough to do anything at all. Ruth asked for
  // both to be named rather than implied - an unbounded rule is one nobody can
  // check. See lib/calorie-rules.ts, key `gain_bounds`.
  return Math.min(Math.max(daily, SURPLUS_FLOOR_KCAL), SURPLUS_CEILING_KCAL);
}

export function calorieFloor(bmrKcal: number | null | undefined): number {
  const bmr = typeof bmrKcal === 'number' && bmrKcal > 0 ? Math.round(bmrKcal) : 0;
  return Math.max(bmr, ABSOLUTE_FLOOR_KCAL);
}

// ------------------------------------------------------- what she is shown

/**
 * One part of the starting-guide panel.
 *
 * Ruth set the shape on 5 October 2026: an intro, two bullets, the paragraph for
 * her approach, a quiet serif line where it is true, the two figures, and a
 * closing line. The screen needs to know which is which - the serif line is not a
 * bullet and the figures are not prose - so the panel is a list of parts rather
 * than a list of strings.
 */
export type WorkingBlock = {
  kind: 'intro' | 'bullet' | 'para' | 'italic' | 'figure' | 'closing';
  text: string;
  /** Set on the bullet that names her activity level, for the link. */
  activityWord?: string;
};

export type TargetWorking = {
  /**
   * The panel, in parts. The screen renders these.
   */
  blocks: WorkingBlock[];
  /**
   * The same panel as plain sentences, for the chat prompt.
   *
   * DERIVED FROM blocks, NEVER WRITTEN TWICE. The model wants prose and the
   * screen wants structure; building them separately is how one number ends up
   * described two ways, which is the fault this whole file exists to prevent.
   */
  lines: string[];
  /** The figure itself, or null when something needed is missing. */
  targetKcal: number | null;
  /** What is still needed, when there is no figure. One short sentence. */
  missing: string | null;
  /** True when the floor raised the figure, so the screen can say so. */
  flooredAt: number | null;
  /**
   * Which line names her activity level, so a screen can make it a link.
   *
   * Ruth, 5 October 2026: "'lightly active' needs to be in bold and a link so
   * they can go back to where they selected it in onboarding when they didn't
   * realise what it meant."
   *
   * AN INDEX RATHER THAN A STRUCTURED LINE. These lines are also joined into a
   * prose block for the chat model, which wants sentences and not a tree, and
   * every other caller renders them as plain text. The one screen that wants a
   * link is told which line to split, on a word it already has.
   */
  activityLineIndex: number | null;
};

const kcal = (n: number) => `${n.toLocaleString('en-GB')} kcal`;

/**
 * The figures and how they were reached, for showing her before anything saves.
 *
 * EVERY LINE IS SOMETHING SHE CAN CHECK. The weight she gave, the height she
 * gave, how active she said she is, the arithmetic, and the adjustment her goal
 * makes. Nothing in here is rounded for presentation beyond the nearest ten,
 * which is the precision the estimate actually has.
 */
export function explainTarget(input: {
  intent: BodyIntent;
  weightKg: number | null | undefined;
  weightSource: 'estimate' | 'measured' | null | undefined;
  bmrKcal: number | null | undefined;
  tdeeKcal: number | null | undefined;
  activityWord: string | null | undefined;
  proteinLow: number | null | undefined;
  proteinHigh: number | null | undefined;
  /**
   * Which way her goal moved the protein range, from calculateProteinTarget.
   *
   * READ FROM THE SUM RATHER THAN RE-DERIVED HERE. This used to print its line
   * from `intent.highProtein`, which is the intent's WISH, while the figures
   * beside it came from the protein module, which knows whether the wish was
   * granted. Two places deciding the same thing is how Ruth ended up with two
   * different protein targets in the first place; this panel now describes the
   * number it is actually showing.
   *
   * REQUIRED, THOUGH IT MAY BE NULL. Making it optional reintroduced the exact
   * fault this whole change was about, one file along: a caller that left it out
   * silently lost the "kept high" sentence and printed a bare range under a
   * recomposition goal, which is the panel failing to explain the one thing
   * recomposition DOES. check-weight-and-targets.mjs caught it on the first run.
   * A caller with nothing to say passes null and means it.
   */
  proteinStepped: 'up' | 'held' | 'plain' | null;
  /**
   * Whether she has paused the deficit - a holiday, a hard week, any reason.
   *
   * Ruth, 2 October 2026: "if you go on holiday you may want to pause the
   * deficit". A DIFFERENT PAUSE FROM TRAINING: a fortnight away is a reason to
   * stop eating under what she uses and no reason to drop her protein.
   *
   * REQUIRED THOUGH IT MAY BE NULL, like proteinStepped above and for the reason
   * written there: an optional flag is one four callers out of five forget.
   */
  deficitPaused: boolean | null;
  /**
   * Whether she stated a weight direction at all - lose, maintain or gain.
   *
   * THE WHOLE OF THE BUILD-ALONE DISTINCTION (her final rules, 4 October 2026):
   * "Build muscle" with nothing said about weight gets a small surplus, 5% of
   * what she uses; "Maintain my weight" with it does not, because she said so.
   * The fat/muscle pair is maintain/increase either way, so the intent cannot
   * tell them apart and this is the only thing that can.
   *
   * REQUIRED THOUGH IT MAY BE NULL, like the two flags above. It arrived here
   * BECAUSE calculateCalorieTarget grew the rule and this panel did not: Today
   * would have shown her 5% over and the setup screen "around what you use", for
   * the same switches, on the same evening. Null and undefined both read as
   * stated, which is the branch that adds nothing.
   */
  weightDirectionStated: boolean | null;
}): TargetWorking {
  const { intent, weightKg, bmrKcal, tdeeKcal, activityWord } = input;
  // THE EARLY RETURNS CARRY NO SENTENCES. Both of them say what is missing in
  // `missing`, which is the one thing a screen shows when there is no panel to
  // show - a half-built panel above "Add your weight to see your guide" is the
  // app talking over its own question.

  if (weightKg == null || weightKg <= 0) {
    return {
      lines: [],
      blocks: [],
      targetKcal: null,
      missing: 'Add your weight to see your guide.',
      flooredAt: null,
      activityLineIndex: null,
    };
  }

  if (bmrKcal == null || bmrKcal <= 0 || tdeeKcal == null || tdeeKcal <= 0) {
    return {
      blocks: [],
      lines: [],
      targetKcal: null,
      // Height is the other input BMR cannot do without, and the activities
      // screen is where it is asked.
      missing: 'Your height is needed as well, to work out the rest.',
      flooredAt: null,
      activityLineIndex: null,
    };
  }

  const bmr = Math.round(bmrKcal);
  // ROUNDED TO THE NEAREST TEN, like the figure it leads to. It read 1,551 here
  // and 1,550 three lines down, which looks like two different numbers and is
  // one number at two precisions. The estimate does not have units of one.
  const tdee = Math.round(Math.round(tdeeKcal) / 10) * 10;

  // HER PANEL (5 October 2026), and the weight line is deliberately not in it.
  // It said "Weight: 56.55 kg, from your last weigh-in" above everything else,
  // which opens a panel about her guide with a number she did not ask about.
  const blocks: WorkingBlock[] = [{ kind: 'intro', text: GUIDE_FRAME.intro }];
  blocks.push({
    kind: 'bullet',
    text: fill(GUIDE_FRAME.restBullet, { resting: bmr.toLocaleString('en-GB') }),
  });
  blocks.push(
    activityWord
      ? {
          kind: 'bullet',
          text: fill(GUIDE_FRAME.activityBullet, {
            'activity phrase': activityWord,
            'activity kcal': tdee.toLocaleString('en-GB'),
          }),
          activityWord,
        }
      : {
          kind: 'bullet',
          // NO ACTIVITY LEVEL YET, so her second bullet has nothing to name. The
          // sum is still true, and the phrase it would have linked to is the
          // thing she has not answered.
          text: `Altogether that comes to about ${tdee.toLocaleString('en-GB')} kcal a day.`,
        }
  );

  const paras: string[] = [];
  // Kept only so the branches below compile unchanged; nothing reads it.
  void paras;
  const floor = calorieFloor(bmr);
  let target = tdee;
  let flooredAt: number | null = null;

  if (intent.key === 'lose_fat') {
    // PAUSED FOR A HOLIDAY, AND STILL HER GOAL (2026-10-02).
    if (input.deficitPaused === true) {
      paras.push(
        `Your deficit is paused, so this is simply what you use. Losing fat is still your approach and nothing about it has changed - you are just not eating under it at the moment.`
      );
    } else {
      // 0.5% of bodyweight a week, at 7,700 kcal per kg, spread over seven days.
      const daily = Math.round((0.005 * weightKg * 7700) / 7);
      paras.push(
        `Losing fat gently is about half a percent of your weight a week, which works out as ${kcal(
          daily
        )} a day less than you use.`
      );
      target = tdee - daily;
      if (target < floor) {
        flooredAt = floor;
        paras.push(
          `That would come to ${kcal(target)}, which is below what your body uses at rest, so it is held at ${kcal(
            floor
          )} instead.`
        );
        target = floor;
      }

      // WHAT THE DEFICIT ACTUALLY MEANS, IN THE UNITS SHE THINKS IN (2026-10-02).
      //
      // Ruth: "it needs to be clear if there is a deficit target and explain
      // roughly what that means in terms of fat loss expected per week and how
      // that relates to the kcal deficit daily and per week."
      //
      // A daily number on its own is the one number that does NOT answer "so how
      // fast is this?". The week is the unit a person actually lives in, and
      // seeing 1,960 kcal a week next to "about 0.28 kg" is what makes a gentle
      // rate feel like a choice rather than a disappointment.
      //
      // COMPUTED FROM THE DELTA THAT SURVIVED THE FLOOR, not from the 0.5% that
      // was asked for. When the floor bites, the real deficit is smaller and so
      // is the expected loss; quoting the intended rate there would be the app
      // promising a result its own arithmetic has already refused.
      const actualDaily = tdee - target;
      if (actualDaily > 0) {
        const weekly = actualDaily * 7;
        const kgPerWeek = (weekly / 7700).toFixed(2);
        paras.push(
          `So this is a deficit: ${kcal(actualDaily)} a day under what you use, which is about ${kcal(
            weekly
          )} across a week.`
        );
        paras.push(
          `At roughly 7,700 kcal to a kilo of body fat, that is about ${kgPerWeek} kg a week if everything holds steady. Bodies are not that tidy week to week, so read it as a direction rather than a schedule.`
        );
      }
    }
  } else if (intent.key === 'gain_weight' || intent.key === 'gain_and_muscle') {
    // THE SAME 150 AS BUILDING MUSCLE, and said in the same plain way. A larger
    // surplus gains faster and gains fat; it is also the number somebody under
    // pressure would reach for, which is the reason it is not offered.
    // THE RULE AND ITS CONSTANT, SHOWN RATHER THAN A BARE NUMBER (her item 5).
    // Half the fat-loss rate, scaled to her, with the ceiling and the energy
    // constant both stated so the figure can be checked rather than trusted.
    const surplus = gainSurplusKcal(weightKg);
    paras.push(
      `Gaining steadily is about a quarter of a percent of your weight a week. At 7,700 kcal to a kilo that comes to ${kcal(
        surplus
      )} a day more than you use, and it never goes above 300.`
    );
    paras.push(
      `Nothing faster, because faster is mostly fat and harder to keep. There is nothing to reach and no date.`
    );
    target = tdee + surplus;
    if (intent.key === 'gain_and_muscle') {
      paras.push(
        `Protein stays high alongside it, so more of what you gain is muscle rather than fat.`
      );
    }
    // SAID EVERY TIME, CALMLY, AND NOT AS A WARNING ABOUT HER. It is one line
    // about a fact of medicine, placed where somebody choosing this will read
    // it, and it carries no assessment of her body and no instruction.
    paras.push(
      `If you have been losing weight without meaning to, it is worth telling your doctor. Selodía is not a medical service and this is not a plan for recovering from an eating disorder - that needs a clinician, and this stays gentle either way.`
    );
  } else if (intent.key === 'build_muscle') {
    // A SURPLUS WITH NOTHING TO BUILD WITH IS JUST A SURPLUS (2026-10-02).
    //
    // Ruth: "more sedentary weeks should keep to the maintenance kcal".
    //
    // The 150 kcal is there to feed muscle being built. With training paused
    // there is nothing asking for it, and the same 150 kcal a day becomes fat
    // gain while the screen calls it building muscle. So a pause holds it at
    // maintenance.
    //
    // IT DOES NOT CUT BELOW MAINTENANCE EITHER. A pause is not a reason to put
    // her in a deficit she did not choose, and it does not touch the deficit of
    // somebody who DID choose one - losing fat is still the thing she asked for,
    // training or not.
    // BUILDING MUSCLE NO LONGER ADDS CALORIES (her decision A, 4 October 2026).
    // It is recomposition at the weight she is now: the change comes from the
    // protein and the training, and nothing is added unless she asked to gain.
    //
    // UNLESS SHE SAID NOTHING ABOUT HER WEIGHT, which her final rules make a
    // different answer rather than the same one: building with no instruction
    // either way gets 5% of what she uses, "on the low side because fat is
    // easier to gain at this stage of life". Maintain plus Build is the case
    // this line was written for, and it keeps it.
    if (input.weightDirectionStated === false) {
      const surplus = Math.round(tdee * BUILD_SURPLUS_FRACTION);
      paras.push(
        `Building muscle asks for a little more than you use: 5%, which is ${kcal(
          surplus
        )} a day. The low side on purpose, because fat is easier to gain at this stage of life.`
      );
      paras.push(
        `Say "maintain my weight" alongside it and this comes back to what you use - the switches decide, not the app.`
      );
      target = tdee + surplus;
    } else {
      paras.push(
        `Building muscle means eating around what you use, not over it. The change comes from the protein and the training.`
      );
    }
  } else if (intent.key === 'recomposition') {
    paras.push(
      `Less fat with more muscle means eating around what you use rather than under it. The change comes from the protein and the training, not from a deficit.`
    );
  } else {
    paras.push(`Staying as you are means eating around what you use.`);
  }

  const rounded = Math.round(target / 10) * 10;

  // HER TEN STATES, FROM THE RECORD (5 October 2026). The branches above work out
  // the FIGURE; this is the text she wrote for whichever state that figure
  // belongs to, filled at the braces and not edited anywhere else.
  //
  // THE PARAGRAPHS THE OLD BRANCHES PUSHED ARE GONE. They said the same things in
  // my words - the weekly deficit in kilos, the surplus ceiling, the floor - and
  // her paragraph says what it says. Two descriptions of one number is the fault
  // this file has been rebuilt around twice.
  const asMode: BodyMode = {
    loseFat: intent.fat === 'reduce',
    gainWeight: intent.fat === 'increase',
    maintainWeight: intent.fat === 'maintain' && input.weightDirectionStated !== false,
    buildMuscle: intent.muscle === 'increase',
  };
  const state = guideStateFor({ mode: asMode, paused: false, weightKnown: true });
  const values = {
    guide: rounded.toLocaleString('en-GB'),
    surplus: Math.abs(rounded - tdee).toLocaleString('en-GB'),
  };

  blocks.push({ kind: 'para', text: fill(state.paragraph, values) });
  if (state.italic) blocks.push({ kind: 'italic', text: state.italic });
  if (state.smallLine) blocks.push({ kind: 'para', text: state.smallLine });

  blocks.push({ kind: 'figure', text: fill(GUIDE_FRAME.guideFigure, values) });

  const { proteinLow, proteinHigh } = input;
  if (proteinLow != null && proteinHigh != null && proteinLow > 0) {
    blocks.push({
      kind: 'figure',
      text: fill(GUIDE_FRAME.proteinFigure, {
        'protein low': proteinLow,
        'protein high': proteinHigh,
      }),
    });
  }

  blocks.push({ kind: 'closing', text: GUIDE_FRAME.closing });

  const lines = blocks.map((b) => b.text);
  const activityLineIndex = blocks.findIndex((b) => b.activityWord != null);

  return {
    blocks,
    lines,
    targetKcal: rounded,
    missing: null,
    flooredAt,
    activityLineIndex: activityLineIndex === -1 ? null : activityLineIndex,
  };
}
