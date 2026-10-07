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
// WHERE IT SITS, AND WHY IT IS NOT ITS OWN SECTION.
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

/** The section it is rendered inside, rather than beside. */
export const CARE_PARENT_SECTION = 'Health';

/**
 * What she sees when the group is there but has nothing in it yet.
 *
 * NAMES THE THING SHE WOULD DO, not the state of the database. "No records yet"
 * describes the app to her; this describes what putting one here is for. The
 * group only appears once the Health section exists, so this is never the first
 * thing she meets on an empty tab.
 */
export const CARE_EMPTY =
  'Nothing here yet. Share a letter or an appointment email in chat and the details worth keeping land here.';
