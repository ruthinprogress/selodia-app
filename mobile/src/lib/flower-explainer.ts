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
      'Holding on to muscle, which the body gives up faster from your forties onwards unless something asks it not to.',
  },
  cardio: {
    title: 'Cardio',
    spec: 'Cardiovascular and respiratory endurance. Heart and lung health, VO2max [2]',
    plain: 'Heart and lungs. How much you can do before you are out of breath.',
  },
  flexibility: {
    title: 'Flexibility',
    spec: 'Range of motion at joints. Injury prevention, functional movement [3]',
    plain: 'How far your joints move. Mostly it shows up as not getting hurt doing ordinary things.',
  },
  balance: {
    title: 'Balance',
    spec: 'Postural stability and neuromuscular control [4]. Falls prevention — particularly important at 40+ [10]',
    plain:
      'Staying steady, and catching yourself when you are not. It matters more every year and it trains quietly.',
  },
  bone: {
    title: 'Bone loading',
    spec: 'Mechanical stress on the skeleton. Bone mineral density maintenance against menopausal decline [5]',
    plain:
      'Putting weight through the skeleton so it stays dense. Bone responds to being asked and to very little else.',
  },
  recovery: {
    title: 'Recovery',
    spec: 'Active restoration. Sleep quality, parasympathetic activity, stress reduction [6]',
    plain: 'Sleep, rest and the gentle end of things. It is work the body does, not time off from it.',
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
export const EXPLAINER_TITLE = 'What this shows';

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
  'Six things movement protects, and most activities cover several at once. A ballet class reaches four of them. An ordinary week usually does more than people expect.';

/**
 * HOW A PETAL FILLS, without the number.
 *
 * WEEKLY_TARGET is 200 and its own comment says it is "a choice, not a
 * measurement" that "will want tuning once there is a real week of data to look
 * at". A figure in prose rots the day it is tuned, so this says the shape of it
 * instead.
 */
export const EXPLAINER_METHOD =
  'Each thing you log adds to every petal it touches, more for the ones it does most. Roughly two strong sessions fill a petal. Nothing is ever marked missing, and a petal you have not fed simply is not drawn.';

/**
 * THE STATUS OF THE NUMBERS, said out loud. Ruth's decision, and the spec's
 * methodology note is the reason it has to be said rather than implied.
 */
export const EXPLAINER_EVIDENCE =
  'The six come from what the evidence says protects a body through the forties and beyond. How much each activity counts towards each one is our own calibrated estimate, and is going out for expert review. We would rather tell you that than imply more certainty than we have.';

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
 */
export const EXPLAINER_UNLOGGED =
  'This draws what you have logged, not everything you have done. Pushing a loaded pram up a hill, or running up and down the escalators at the tube, is real work your body is getting credit for nowhere. Log it if you like. If it happens most weeks, it can live in your Week and count from then on.';

/** The words on the link into the Week. */
export const EXPLAINER_WEEK_LINK = 'Open your Week';
