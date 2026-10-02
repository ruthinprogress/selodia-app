// THE BODY MANUAL: EVERY ANSWER SHE HAS GIVEN, IN ONE PLACE.
//
// Ruth, 2 October 2026, and this is her design rather than mine:
//
//   "The Body Manual created should be reachable by the user after it's filled in
//   in one place... Onboarding is only once. What's the benefit of sending them
//   back? If they have completed the whole thing once, all the details can just go
//   into their profile like the rest of the details... That way we wouldn't need
//   'Redo my setup' at all. Users could see their answers and choose what to
//   update if they wanted to."
//
// WHY IT REPLACES A REDO RATHER THAN SITTING BESIDE ONE. Almost every fault of
// 1 and 2 October came from replaying a wizard over answers that already existed:
// her week deleted by the activities screen, the whole pre-fill machinery that
// existed only to make a redo safe, the overwrite semantics, the load flag that
// produced five dead screens, and the confirm step that lost her 45 kg goal. A row
// edited in place has none of it. One field, one visible current value, one write.
// There is no "does unticking delete?" question because she is not re-answering a
// set.
//
// ONE STORE, NEVER TWO. Every row below reads and writes the table onboarding
// already writes. There is no body_manual table and nothing is copied between
// them. Her own rule, from the Skills brief: "this team has already built a second
// system for something that existed." A second store is also how the Manual would
// come to disagree with the app, which is the one thing it exists to stop.
//
// LIVE, NOT SNAPSHOTTED. Adding an allergy in chat puts it on the Manual that
// second, because the Manual is a view of the same rows. Her instinct was a
// snapshot "when things change"; the reason she could not answer "how often" is
// that each row already carries its own dates, so the change itself is the record.
// A removal writes an Almanac card before the row goes - see the
// removal_to_almanac trigger. The one snapshot worth having is the starting point,
// written once when onboarding completes.

/** Where a row's answers live, so nothing has to guess. */
export type BodyManualSection = {
  key: string;
  /** The heading she reads, collapsed. */
  heading: string;
  /** The one line under it when open. Says what the answers change. */
  note: string;
  /**
   * What to say when she has never answered it. Never a reproach, and never a
   * count of what is missing.
   */
  empty: string;
  /**
   * True when she cannot edit it here because it maintains itself. Weight is the
   * only one: the latest real weigh-in already wins over any estimate.
   */
  readOnly?: boolean;
  /**
   * True when the row is answered ON the row, with chips, rather than by opening
   * a setup screen.
   *
   * THERE IS NO SETUP SCREEN FOR THIS ONE AND THERE SHOULD NOT BE. She removed
   * the redo wizard this afternoon; adding a new wizard screen for a single
   * two-state answer would be walking it back in. It is one field with one
   * current value, which is the whole shape the Manual was built for.
   */
  inline?: boolean;
};

export const BODY_MANUAL_HEADING = 'Body Manual';

// HER WORDING, TIGHTENED, AND SHE PICKED THIS VERSION. Hers was "these details
// create context for what you learn about your body".
export const BODY_MANUAL_NOTE =
  'What you have told Selodía about your body. It gives everything you notice some context, and you can add to it any time.';

/**
 * The rows, in the order she listed them.
 *
 * "In your sessions" IS NOW "Movements to leave out". She forgot what the first
 * one meant when I used it back to her, which is the only test a heading has to
 * pass. Her own item 5 called it "movements to leave out of sessions".
 */
export const BODY_MANUAL_SECTIONS: BodyManualSection[] = [
  {
    key: 'days',
    heading: 'How your days feel',
    note: 'The guiding source for how Selodía talks to you. Nothing here is a promise to fix anything.',
    empty: 'Not said yet. Add it any time.',
  },
  {
    key: 'goal',
    heading: 'Your body goal',
    note: 'Sets your calorie and protein targets. Changing it keeps the old one, dated, in your Almanac.',
    empty: 'Not set yet, so there is no calorie target. Add it any time.',
  },
  {
    // WHETHER THE PROTEIN TARGET'S ASSUMPTION IS TRUE (2026-10-02).
    //
    // Ruth: "The protein target (101-123g) assumes you're actively resistance
    // training to drive the recomp - without that stimulus, it's a
    // maintenance-range target in disguise. Flag when the user isn't currently
    // training (injury, pause, etc.)"
    //
    // IT SITS UNDER THE GOAL BECAUSE IT CHANGES THE GOAL'S FIGURES. It is not a
    // fact about her body like the rows below; it is the condition the body
    // goal's protein and calorie targets rest on.
    key: 'training',
    heading: 'Whether you are training',
    note: 'Protein goes to the top of its range while you are training, because that is what the extra is for. Say you are paused and it comes back to the maintenance range until you start again.',
    empty: 'Not said, so your targets assume you are training.',
    inline: true,
  },
  {
    key: 'weight',
    heading: 'Your weight',
    note: 'Updates itself from your latest reading. A real weigh-in always beats a guess.',
    empty: 'No weight yet. Add one and your targets appear.',
    readOnly: true,
  },
  {
    key: 'skills',
    heading: 'What you want to be able to do',
    note: 'Each one keeps its own steps. Nothing has a date on it.',
    empty: 'Nothing yet. Say one in chat any time.',
  },
  {
    key: 'week',
    heading: 'What you already do',
    note: 'The shape of your week, not a target to hit. Nothing in it is ever marked done or missed.',
    empty: 'Nothing yet. Add it here or say so in chat.',
  },
  {
    key: 'plate',
    heading: 'On your plate',
    note: 'The only part of this that changes what you are offered to eat.',
    empty: 'Nothing yet.',
  },
  {
    key: 'skin_air',
    heading: 'Skin and air',
    note: 'Kept so Selodía knows. It does not change what you are offered to eat.',
    empty: 'Nothing yet.',
  },
  {
    key: 'medicines',
    heading: 'Medicines you react to',
    note: 'Kept so Selodía knows. Nothing here is advice and it never comments on what you take.',
    empty: 'Nothing yet.',
  },
  {
    key: 'movements',
    heading: 'Movements to leave out',
    note: 'These stay out of everything Selodía builds for you.',
    empty: 'Nothing yet.',
  },
  {
    key: 'avoid',
    heading: 'Anything else to steer around',
    note: 'Your words, kept as you typed them.',
    empty: 'Nothing yet.',
  },
  {
    key: 'body',
    heading: 'Periods and hormones',
    note: 'Changes how a cycle day is read, and stops a bleed on HRT being read as a natural cycle.',
    empty: 'Not said yet. All of it is optional.',
  },
  {
    key: 'takes',
    heading: 'What you take regularly',
    note: 'Kept in Me exactly as you typed it. Selodía is not a medical service and does not replace advice from your doctor.',
    empty: 'Nothing yet.',
  },
];

/** What a row currently holds: lines to show, and whether she has answered it. */
export type SectionContents = {
  lines: string[];
  /** Shown under the lines where removal is a tap rather than an edit. */
  removable?: { label: string; table: 'allergies' | 'user_rules' | 'user_week' | 'user_skills'; id: string }[];
};
