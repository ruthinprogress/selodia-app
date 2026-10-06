// THE NAME AND THE TAGLINE, IN ONE PLACE.
//
// WHY THIS FILE EXISTS (Ruth, 6 October 2026): "my bad on not correcting the tag
// line on prompt. It should always be - Your body isn't a problem to solve. It's
// something to get to know."
//
// It was not her mistake. The tagline has been settled since 31 August and
// SELODIA_SPEC.md says so in capitals: "CONFIRMED FINAL... This is existing
// manifesto copy, carried over verbatim; it is not new and is not up for
// redrafting here." It is on the website, in the store submission and in the
// marketing spec.
//
// And the app said something else. The About screen and the welcome screen both
// carried a line I had written, because neither of them read from anywhere - they
// each had their own copy, and a second copy of a settled thing is a copy that
// can be wrong on its own.
//
// SO THERE IS ONE OF IT NOW, and check-brand.mjs reads the tagline out of
// SELODIA_SPEC.md and compares. The spec is where it was confirmed, so the spec
// is what the app has to agree with.

/** Always with the accent. It is the name. */
export const APP_NAME = 'Selodía';

/**
 * CONFIRMED FINAL, 31 August 2026. Existing manifesto copy, verbatim.
 *
 * Two sentences, and they do different jobs: the first is what Selodía is not,
 * the second is what it is. Neither works alone.
 */
export const TAGLINE = "Your body isn't a problem to solve. It's something to get to know.";

/**
 * THE TWO HALVES, for a screen that sets it large.
 *
 * NOT A WRAP, AND THAT IS THE POINT. Android has now mis-drawn wrapped text in
 * this app three times: the Log screen as "Loq", every unselected tab losing its
 * last letter, and the welcome screen rendering "Welcome to Selodía" as "Welcome
 * to" with the second line blank. Each time the cause was measurement and
 * drawing disagreeing about a line, and each time the fix that held was to stop
 * asking it to work out where a line ends.
 *
 * A title that must break gets its lines written out here.
 */
export const TAGLINE_LINES = [
  "Your body isn't a problem to solve.",
  "It's something to get to know.",
] as const;

/** "Welcome to" and the name, as two deliberate lines for the same reason. */
export const WELCOME_TITLE_LINES = ['Welcome to', APP_NAME] as const;
