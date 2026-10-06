// AFTER FINISH: HER WORDS, AND THE TWO THINGS THAT HAPPEN ONCE.
//
// Ruth, 5 October 2026:
//
//   "After Finish: the screen fades to terracotta; the seed mark fades in and
//   gently pulses; 'Welcome to Selodía' and the tagline;
//   the seed pulses once more; the app opens on the Body Manual."
//
// WHY THERE IS NO FIRST DRAFT ANY MORE. It summarised back the seven answers she
// had just given, one screen after giving them, with a Start button under it.
// Her instruction was to remove it outright, and she is right: a summary of
// something somebody has just done is a receipt, and the Body Manual is the same
// summary in the place it will live from now on.
//
// THE TIMINGS ARE A SEQUENCE, NOT A STYLE. Each is named here so the screen reads
// as a score rather than as a pile of magic numbers, and so check-welcome.mjs can
// assert the one thing that matters: the whole thing is under six seconds and
// every step has a way past it.
//
// NOTHING HERE OWNS THE ONLY WAY FORWARD. Reduce motion skips to the words and
// moves on, a tap at any point ends it, and the navigation happens whether or not
// a single frame was drawn. An animation that is also the only route out of a
// screen is a screen that strands somebody the first time a frame drops.

import { APP_NAME, TAGLINE, TAGLINE_LINES, WELCOME_TITLE_LINES } from '@/lib/brand';

export const WELCOME = {
  /**
   * TWO LINES, WRITTEN OUT, NOT WRAPPED (Ruth's screenshot, 6 October 2026).
   *
   * It rendered as "Welcome to" with the second line blank on her phone: the
   * name was measured, given its space, and never drawn. Third time Android has
   * mis-drawn a line in this app - "Loq", the "Wee" tabs, and now this - and all
   * three were measurement and drawing disagreeing about where a line ends.
   *
   * So nothing here wraps. See lib/brand.ts.
   */
  titleLines: WELCOME_TITLE_LINES,
  /** Kept for anything that wants the whole string, never for drawing. */
  title: `Welcome to ${APP_NAME}`,
  /**
   * HER TAGLINE, AND IT WAS ALREADY SETTLED. I wrote "Understand your body. Live
   * in it." into her brief and she took it; the real one has been CONFIRMED
   * FINAL in the spec since 31 August and is on the website and the store
   * listing. Her correction: "It should always be..."
   */
  line: TAGLINE,
  lineParts: TAGLINE_LINES,
  /** Said quietly at the bottom, because a screen with no way past it is a trap. */
  skip: 'Tap to continue',
} as const;

/**
 * THE ONE MESSAGE WAITING IN CHAT, in her words.
 *
 * WRITTEN BY THE APP, NOT THE MODEL. It is the same rule as every other
 * statement of fact in this project: the app says what happened, the model never
 * claims it. A greeting generated on the first turn would be different every
 * time and could say anything.
 *
 * AND IT IS WRITTEN ONCE. welcome_seen_at is the stamp; a second Finish does not
 * add a second greeting, because two identical welcomes in a thread is the app
 * forgetting it had already said hello.
 */
export const WELCOME_MESSAGE =
  "Welcome to Selodía. Everything you've shared is a starting point, not a commitment. " +
  'As life changes, simply say so in chat and your guide will change with you. ' +
  'How are you doing today?';

/** Milliseconds. The whole sequence, from a dark screen to the Body Manual. */
export const WELCOME_TIMING = {
  /** The terracotta washes in under the last question. */
  fadeIn: 600,
  /** The seed appears. */
  seedIn: 700,
  /** Its first breath, which is the one she described as gentle. */
  firstPulse: 1400,
  /** The words. */
  wordsIn: 600,
  /** The second breath, after the words. */
  secondPulse: 1200,
  /**
   * A BEAT ON THE FINISHED PICTURE, AND IT WAS NOWHERE NEAR LONG ENOUGH.
   *
   * Ruth, 6 October 2026: "the welcome message needs to persist a little longer,
   * it doesn't feel like it has enough time to be read fully and feel like a
   * moment."
   *
   * At 500ms the words arrived at 3.3 seconds and the screen left at 5, so there
   * were 1.7 seconds to read four lines - the name, and a two-line tagline that
   * was one line when these numbers were chosen. I picked them against a cap I
   * had also chosen, which is not a measurement of anything.
   *
   * 2500 gives a little under four seconds on the finished picture. That is a
   * beat rather than a pause, and it is still tappable from the first frame.
   */
  rest: 2500,
} as const;

/** What the whole thing costs in time, which is the number worth watching. */
export const WELCOME_TOTAL_MS =
  WELCOME_TIMING.fadeIn +
  WELCOME_TIMING.seedIn +
  WELCOME_TIMING.firstPulse +
  WELCOME_TIMING.wordsIn +
  WELCOME_TIMING.secondPulse +
  WELCOME_TIMING.rest;

/**
 * REDUCE MOTION GETS THE WORDS AND THE SAME ENDING, QUICKLY.
 *
 * Not nothing: the welcome is the meaning and the breathing is only how it
 * arrives, which is the same reasoning the Health Flower's seed already uses.
 * Holding still forever would be worse than animating at somebody.
 *
 * LONGER SINCE 6 OCTOBER, for the same reason the animated one is: there are
 * four lines to read now and 2.2 seconds was not enough for them. Everything
 * arrives at once here, so it needs the reading time without the arriving time.
 */
export const WELCOME_REDUCED_MS = 3600;

/** Where it goes when it is done. Her words: "the app opens on the Body Manual." */
export const AFTER_WELCOME_ROUTE = '/settings/body-manual';

/**
 * THE SEED ON THE BODY MANUAL, which is her correction to my first answer.
 *
 * I proposed a pulsing seed inside the Chat tab. The bottom bar is a real native
 * tab bar - that is what fixed the "Wee" label - and a native tab item cannot
 * hold an animation. Her answer was better than my workaround:
 *
 *   "I meant that the seed would be a button on top of the Body Manual to avoid
 *   pressing back twice to enter the app."
 *
 * AND SHE HAD DIAGNOSED IT EXACTLY. The Body Manual lives at /settings/body-manual,
 * inside a Settings stack that is itself presented over the tabs. Arriving there
 * from setup means the tabs are not underneath, so leaving takes two presses: one
 * out of the Manual, one out of Settings. The seed is the way in, in one tap.
 */
export const WELCOME_SEED = {
  label: 'Start a conversation',
  hint: 'Selodía has something waiting for you',
} as const;
