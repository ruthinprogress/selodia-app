// CLIENT MIRROR of `app/lib/care-admin.ts`. The Next build resolves no '@/'
// alias and the two sides do not share a tsconfig, so the strings are copied
// rather than imported, exactly as calorie-target.ts and me-card.ts are.
//
// TWO COPIES OF THE SAME STRING IS THE FAULT THIS REPOSITORY HAS HAD SIX TIMES
// IN A FORTNIGHT, so they are compared both ways by check-care-section.mjs and
// neither side is allowed to drift. The server decides what section a care card
// is filed under; this side decides what she reads at the top of it. If those
// ever disagree, the heading appears over an empty group and her records sit
// under a section name nothing renders.
//
// ---------------------------------------------------------------------------
// WHERE IT SITS: ITS OWN SECTION, LAST ON THE ME TAB (12 October 2026).
//
// Ruth: "How I Access Care needs to be its own section at the bottom of the
// list. It's not working hidden." It had been a group inside Health, for the
// reasons kept below. Inside Health it could not be found, and a record she
// cannot find is no record. Last on the page keeps the part of her first answer
// that still holds: it never leads, so the app still does not open by saying
// her life is about health issues.
//
// WHAT IT WAS, AND WHY, kept so the next person does not move it back.
//
// She has a Health section already. It holds her Seasonal Allergy Plan, which is
// a thing she FOLLOWS. A consultant's secretary's direct line is not that: it is
// the paperwork of being seen. Both are "health", which is exactly why they
// looked like the same kind of card to me and are not.
//
// Her answer, 6 October 2026: "Bit there's health already in Me, so how would
// this go, just Care underneath it?" So it goes underneath it. One section in
// her list, two groups once she is in it - what she follows, then the paperwork
// below a quiet rule.
//
// NOT A TOP-LEVEL SECTION, because of something she has said twice: "I don't
// want it prominent. I like that it sits with the rest of my life, so the app
// doesn't say my life is about health issues."

/**
 * The line under the heading, her words (6 October 2026): "How I Access Care.
 * Letters, numbers, references, emails".
 *
 * It is the fence the heading stopped carrying when "Care Admin" became "How I
 * Access Care". Four nouns, in her order, every one a thing you can hold rather
 * than a thing you have.
 */
export const CARE_SUBTITLE = 'Letters, numbers, references, emails';

/** The section a care record is filed under. Must equal the server's. */
export const CARE_SECTION = 'How I Access Care';

/**
 * WHAT SHE SEES AT THE TOP OF IT (Ruth, 20 October 2026):
 *
 *   "We have Health competing with How I Access Care, which is confusing...
 *    HOW i access Care - rename to 'Health Care Records'. merge 'Health' into
 *    Health care records"
 *
 * RENAMED AT RENDER, NEVER IN THE DATABASE, which is the pattern goal-display
 * already uses and the reason it exists. CARE_SECTION above is the value
 * written into every care record's content and matched against on the server;
 * changing that string would mean rewriting rows she has already filed, and
 * leaving any that were missed invisible. The stored word is an identity. This
 * is the heading.
 */
export const CARE_SECTION_LABEL = 'Health Care Records';

/**
 * The section whose cards now live under that heading too.
 *
 * "Health" and "How I Access Care" sat side by side as two separate things,
 * and she is right that nobody can tell from the outside which of her health
 * notes belongs in which. One heading, both kinds of card.
 */
export const MERGED_INTO_CARE = 'Health';

/**
 * What she sees when the group is there but has nothing in it yet.
 *
 * NAMES THE THING SHE WOULD DO, not the state of the database. "No records yet"
 * describes the app to her; this describes what putting one here is for. The
 * section is always shown, last, so this is what a new account sees there.
 */
export const CARE_EMPTY =
  'Nothing here yet. Share a letter or an appointment email in chat and the details worth keeping land here.';
