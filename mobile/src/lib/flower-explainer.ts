import type { Dimension } from '@/lib/health-flower';

// WHAT THE SIX ARE, AND WHY THOSE SIX.
//
// Ruth, 20 October 2026: "I also think an explanation of why it is those
// categories and how it's calculated might be useful in a collapsible below
// it." And on what the drawing is actually for: "It's hard to remember to do
// everything or remember what covers what. It's also actually encouraging to
// see that a lot of activities fill up the requirements naturally."
//
// TWO VERSIONS OF EACH DEFINITION, AND THE SECOND IS WHY THIS FILE EXISTS.
//
//   spec   the definition verbatim from SELODIA_SPEC.md, Part Eight, "The six
//          health dimensions". Never shown to anybody. It is here so that
//          check-flower-explainer.mjs can compare it to the spec file, and
//          fail the moment the two stop matching.
//   plain  what the screen actually says, in this app's voice rather than the
//          spec's: short sentences, no jargon, no citation numbers.
//
// An explainer is the longest label in the app, and a week of fixing labels
// that had stopped matching the code is the reason it is tied down rather than
// typed out and trusted. If somebody edits the spec, the check fails and
// whoever repairs it has the plain line in front of them at the same time.
//
// WHAT THIS FILE MUST NOT CONTAIN, and the reason is in the spec's own
// methodology note: the weightings are "evidence-based calibrated estimates,
// not values extracted directly from research papers... the starting point for
// expert review, not the output of it. Specific weightings should not be cited
// in marketing materials until the expert review has been completed and
// published." So no percentages, no table, and no naming of papers. The status
// of the numbers is said out loud instead, which Ruth decided was the honest
// thing and is also the more trustworthy one.

export type DimensionNote = {
  /** The heading on the row. "Bone" on the petal, "Bone loading" here. */
  title: string;
  /** Verbatim from the spec. Checked, never displayed. */
  spec: string;
  /** What the screen says. */
  plain: string;
};

export const DIMENSION_NOTES: Record<Dimension, DimensionNote> = {
  strength: {
    title: 'Strength',
    spec: 'Muscular force production and resistance to load. Critical for muscle mass retention and metabolic health during perimenopause [1]',
    plain:
      'Keeping muscles strong so everyday tasks stay easier.',
  },
  cardio: {
    title: 'Cardio',
    spec: 'Cardiovascular and respiratory endurance. Heart and lung health, VO2max [2]',
    plain: 'Looking after your heart and lungs.',
  },
  flexibility: {
    title: 'Flexibility',
    spec: 'Range of motion at joints. Injury prevention, functional movement [3]',
    plain: 'Helping your joints move comfortably.',
  },
  balance: {
    title: 'Balance',
    spec: 'Postural stability and neuromuscular control [4]. Falls prevention — particularly important at 40+ [10]',
    plain:
      'Keeping you steady and reducing the risk of falls.',
  },
  bone: {
    title: 'Bone loading',
    spec: 'Mechanical stress on the skeleton. Bone mineral density maintenance against menopausal decline [5]',
    plain:
      'Activities that help maintain strong bones.',
  },
  recovery: {
    title: 'Recovery',
    spec: 'Active restoration. Sleep quality, parasympathetic activity, stress reduction [6]',
    plain: 'Rest, sleep and gentler movement that help your body adapt.',
  },
};

/**
 * The order the rows are read in, which is the order of the petals.
 *
 * Not alphabetical and not by how full they are: the drawing above has a fixed
 * order and a list that disagreed with it would make somebody hunt.
 */
export const NOTE_ORDER: Dimension[] = [
  'strength',
  'cardio',
  'flexibility',
  'balance',
  'bone',
  'recovery',
];

/** Opens the explainer. Short, because it sits under a drawing. */
// BODY LITERACY LANGUAGE, NOT A HELP LINK (Ruth, 21 October 2026): "'Learn
// about these six foundations' is but better body literacy language - change it
// from What's this."
//
// "What this shows" is what a tooltip says. These six are the thing the app is
// teaching, and naming them as foundations says they are worth knowing rather
// than that the drawing needs explaining.
export const EXPLAINER_TITLE = "What's protecting you";

/**
 * THE OPENING LINE IS HERS, and it is better than anything written for the job:
 * "it's actually encouraging to see that a lot of activities fill up the
 * requirements naturally."
 *
 * It leads rather than the arithmetic, because the first thing somebody should
 * learn here is that an ordinary life already does more of this than they
 * think, not how a denominator works.
 */
export const EXPLAINER_INTRO =
  'Six kinds of movement help protect your health as you get older. Most activities contribute to more than one, so an ordinary week often does more than you think.';

/**
 * HOW A PETAL FILLS, without the number.
 *
 * WEEKLY_TARGET is 200 and its own comment says it is "a choice, not a
 * measurement" that "will want tuning once there is a real week of data to look
 * at". A figure in prose rots the day it is tuned, so this says the shape of it
 * instead.
 */
export const EXPLAINER_METHOD =
  "Each movement you log contributes to one or more petals. The more often you do something, the more those petals grow. A petal that isn't shown simply means you haven't logged that type of movement yet.";

// THE STATUS OF THE NUMBERS CAME OUT ON 21 OCTOBER 2026, and this note is the
// record of what was traded, because it reverses a decision Ruth made herself.
//
// It read: "How much each activity counts towards each one is our own
// calibrated estimate, and is going out for expert review. We would rather tell
// you that than imply more certainty than we have." Her reasoning when it went
// in was that for an app aimed at women who have been fobbed off, saying so
// reads as trust rather than weakness.
//
// The argument that removed it, which she forwarded and took: "The user doesn't
// need to know your internal model. If anyone ever questions it, you can
// explain it in a help article or FAQ. Leading with uncertainty actually makes
// the feature feel less confident before they've even used it."
//
// NOTHING ABOUT THE EMBARGO CHANGES. SELODIA_SPEC.md Part Eight forbids citing
// specific weightings until the expert review is published, and this explainer
// cites none - check-flower-explainer.mjs still fails on a percentage or on the
// target appearing in any of this copy. What went is the sentence volunteering
// the uncertainty, not permission to overstate.
//
// SO IT NEEDS A HOME, and the FAQ is the one named in the argument for removing
// it. Until that exists, the only place this is said is the spec.

/**
 * THE HONEST LIMIT, and Ruth asked for it specifically: "some activity may not
 * be counted unless it's been logged, and some of daily life like pushing a
 * loaded pram up a hill or running up and down tube escalators might be adding
 * to the full picture."
 *
 * HER EXAMPLES, NOT TIDIED. "Incidental activity" is the phrase a health app
 * reaches for and it names nothing anybody recognises. A loaded pram up a hill
 * is real bone loading and real cardio, and nobody thinks of it as exercise -
 * which is exactly why it goes unlogged and exactly why it is worth saying.
 *
 * It ends by naming the way in rather than the gap, because a disclaimer that
 * somebody can do nothing about is just a smaller drawing with an excuse.
 *
 * AND IT SAID SOMETHING UNTRUE FOR AN HOUR. The first version read "if it
 * happens most weeks, it can live in your Week and count from then on". Ruth:
 * "nothing gets counted from Plans unless it's logged, it's merely a planning
 * tool." She is right and the code agrees - the Week writes no coverage
 * anywhere, and nothing reads it for the flower.
 *
 * That is the exact fault this whole week has been spent on, committed inside
 * the sentence meant to be the honest one.
 *
 * IT NAMES THE MOVEMENT LOG NOW, rather than "logging". Hers again: "The Now
 * flower is made from the movement that was logged in the Movement log." A
 * screen she can open beats a verb she has to interpret, and it is the honest
 * answer to "where does this come from".
 *
 * This stays true after the Week gains a flower of its own: that one will show
 * what a PLAN covers. Only the Movement log reaches this drawing.
 */
export const EXPLAINER_UNLOGGED =
  "The flower reflects what you've logged in your Movement log, not everything you've done. Everyday movement counts too. If it matters to you, log it.";

/**
 * WHAT THE WEEK IS, in her words and separated from the note above.
 *
 * Ruth, 20 October 2026, correcting a tail clause that had tried to do both
 * jobs at once:
 *
 *   "Your Week is where you can timetable/outline your regular activity, see
 *    where there may be gaps to support protective movement and make sure
 *    you're allowing for enough rest. It's the weekly plan for when all goes to
 *    plan."
 *
 * THAT LAST SENTENCE IS THE CLEAREST STATEMENT OF WHAT THE WEEK IS anywhere in
 * this app, and it is hers. It says the thing the Week screen has needed since
 * it was built: a plan is what you intend, not a record of what happened, so
 * nothing on it is ever owed.
 *
 * AND IT IS THE ONE PLACE GAPS BELONG. The drawing above must never show what
 * is missing, because that would be a verdict on a life already lived. A plan
 * is different: what a plan does not cover is a fact about the plan. She says
 * so here herself, which settles the design of the Week's own flower.
 */
export const EXPLAINER_WEEK =
  'Your Week helps you plan a balanced week, making space for movement, recovery and everything else life brings.';

/** The words on the link into the Week. */
export const EXPLAINER_WEEK_LINK = 'Open your Week';
