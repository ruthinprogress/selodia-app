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
  /**
   * True for a row that only belongs when she has asked to lose fat at all.
   *
   * IT USED TO HIDE UNLESS A DEFICIT WAS ACTUALLY RUNNING, on the reasoning that
   * a switch for something her goal does not do is a control looking for a
   * purpose. Ruth, 4 October 2026, having selected "Lose fat" AND "Less fat,
   * more muscle": "no pause button appeared for the deficit. If 'lose fat, build
   * muscle' blocks a pause then they need to be mutually exclusive upon
   * selection."
   *
   * Those two combine to fat down WITH muscle up, which eats around what she
   * uses rather than under it - so there was no deficit, and the row correctly
   * hid itself. The reasoning was right and the outcome was worse than the thing
   * it avoided: she picked something called "Lose fat" and went looking for a
   * control that had silently become inapplicable, with nothing anywhere saying
   * why. An absent explanation is not calm, it is a puzzle.
   *
   * So the row appears whenever she has asked to lose fat, and says plainly
   * which of the two she is on.
   */
  onlyWhenFatLoss?: boolean;
  /** Shown here, changed on Today. One control, one record. */
  toToday?: boolean;
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
    // SET ON TODAY, SHOWN HERE (Ruth, 4 October 2026): "The same control appears
    // in setup, Today and the Body Manual and writes ONE record."
    //
    // The control itself lives on Today, where she already is every day. This row
    // shows the same state and sends her there rather than offering a second way
    // to change it - two screens writing one value is the shape that gave her two
    // protein targets and a goal she had to set twice.
    key: 'goal',
    heading: 'Your current approach',
    note: 'Set on Today, where it sits with your figures.',
    empty: 'Nothing chosen yet, so there is no calorie figure. Set it on Today.',
    toToday: true,
  },
  {
    // HOW ACTIVE HER WEEKS ARE (Ruth, 5 October 2026): "Tap through from Body
    // Manual needs to go directly to the Activity Level Screen, not Today for
    // the user to scramble around figuring out where theyre meant to go."
    //
    // It had no row at all. The only route to it from here was the goal row's
    // link to Today and then finding the link inside the card - two taps and a
    // hunt, for the single biggest term in her daily figure.
    //
    // IT ABSORBED THE TRAINING ROW ON THE SAME DAY. "Whether you are training"
    // sat here with two buttons, and all it did was step protein between the
    // maintenance range and the high one. This question asks the same thing about
    // a usual week, and its lowest option says it outright - "Mostly sitting, and
    // no regular training."
    //
    // TWO CONTROLS FOR ONE FACT CAN CONTRADICT EACH OTHER, and these could: she
    // could say she did no regular training and still carry a protein range whose
    // own explanation read "assumes you are training". Ruth: "yes, remove it.
    // That's all derived from the Today page now with toggles and a pause
    // button." See trainingFromActivity in lib/body-mode.ts.
    key: 'activity',
    heading: 'How active your weeks are',
    // HER WORDING. Mine ranked it - "the biggest single thing in your daily
    // calorie figure" - which is true, and is the app telling her how much a
    // question matters rather than what it is for. Hers says what it does, in the
    // same words as the screen it opens.
    note: 'This gives Selodía the best starting point for your daily calorie guide.',
    empty: 'Not set yet, so your figure assumes very little movement. Worth a moment.',
  },
  {
    // PAUSING A DEFICIT IS NOT ABANDONING A GOAL (2026-10-02).
    //
    // Ruth: "I think if you go on holiday you may want to pause the deficit."
    //
    // A SEPARATE ROW FROM THE TRAINING ONE, on purpose. A fortnight in Spain is a
    // reason to stop eating under what she uses and no reason at all to drop her
    // protein; an injury is the reverse. One combined "paused" would make each
    // one do the other's job badly.
    //
    // IT ONLY APPEARS WHERE IT APPLIES. A goal with no deficit in it - staying as
    // she is, building muscle, recomposition - has nothing to pause, and a switch
    // for a thing that is not happening is a question she has to work out the
    // meaning of before she can ignore it.
    key: 'deficit',
    heading: 'Your deficit',
    note: 'Pausing holds your calories at what you use, for a holiday or any other reason. Your approach stays exactly as it is and nothing is lost.',
    /**
     * UNREACHABLE, AND IT USED TO SAY SOMETHING FALSE (5 October 2026).
     *
     * `empty` shows when a row has no lines, and this row always has lines:
     * deficitLines() answers in all three states, including the one where her
     * approach produces no deficit at all. So this string has never been drawn.
     *
     * It read "Running, as your approach asks." I took that at face value while
     * answering a question of Ruth's and told her the row would claim to be
     * running in a state that has no deficit. It would not - deficitLines says
     * plainly that less fat with more muscle has nothing to pause, and has since
     * she reported exactly that on 4 October.
     *
     * The sentence was still worth removing. Dead copy that contradicts the live
     * copy is a statement standing in for evidence, which is the shape of three
     * separate faults in this repository, and I had just read it as one.
     * check-body-manual-rows.mjs asserts the row can never be empty.
     */
    empty: 'Nothing to pause yet.',
    inline: true,
    onlyWhenFatLoss: true,
  },
  {
    key: 'weight',
    heading: 'Your weight',
    note: 'Updates itself from your latest reading. A real weigh-in always beats a guess.',
    empty: 'No weight yet. Add one and your guide appears.',
    readOnly: true,
  },
  {
    key: 'week',
    heading: 'What you already do',
    note: 'The shape of your week, not something to hit. Nothing in it is ever marked done or missed.',
    empty: 'Nothing yet. Add it here or say so in chat.',
  },
  {
    key: 'skills',
    heading: 'What you want to be able to do',
    note: 'Each one keeps its own steps. Nothing has a date on it.',
    empty: 'Nothing yet. Say one in chat any time.',
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
