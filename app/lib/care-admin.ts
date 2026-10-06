// HOW I ACCESS CARE: HER NAME FOR IT, AND IT SETTLED THE DESIGN (6 Oct 2026).
//
// She was deciding where the care records should sit in her Me tab, which
// already has a Health section, and named the thing instead:
//
//   "Maybe 'Care Admin' so it's very clearly not the thread of a symptom and
//   diagnosis, it's numbers and emails and letters."
//
// Then, a minute later: "Or How I Access Care."
//
// BOTH NAMES DRAW THE SAME LINE AND ONLY ONE OF THEM IS IN HER VOICE. "Admin"
// fences the section off in a word, which is what she was reaching for, and it
// is a chore word in a tab about her life. "How I Access Care" is the same
// boundary said as agency, and it matches the Body Manual headings she approved
// this morning - how your days feel, what you already do each week - which are
// all phrases from her side rather than filing labels.
//
// So the heading does the warmth and the line underneath does the fence. That
// line is CARE_DESCRIPTION below, and it says "numbers, emails and letters" and
// "not a symptom diary" in as many words, because the heading no longer does.
//
// THAT IS A BOUNDARY, NOT A LABEL. It says what goes in and what does not, in
// three words, and it resolves a question I had been circling all day. A
// consultant letter and a seasonal allergy plan are both "health", which is why
// they looked like the same kind of card; they are not the same kind of thing at
// all. One is something she follows. The other is the paperwork of being seen.
//
// WHAT IT IS:
//   The hospital number she reads out at reception.
//   The secretary's direct line.
//   What the letter said, what was agreed, when she is next seen.
//   The route back in if the symptoms return.
//
// WHAT IT IS NOT:
//   A symptom diary. Those are symptom cards and they already exist.
//   A diagnosis history, or any narrative about what is wrong with her.
//   Anything the app has concluded. Everything here came off a document or out
//   of her own mouth.
//
// WHY THE DISTINCTION EARNS ITS KEEP. Her whole brief for this feature is that
// the app should make the admin small enough to do while she is doubting
// herself. Admin is the job. A section that quietly became a record of what is
// wrong with her would be a different product, and one she has said twice she
// does not want: "I don't want it prominent. I like that it sits with the rest
// of my life, so the app doesn't say my life is about health issues."

/**
 * THE LINE UNDER THE HEADING, HER WORDS (6 October 2026): "How I Access Care.
 * Letters, numbers, references, emails".
 *
 * It is the fence the heading stopped carrying when "Care Admin" became "How I
 * Access Care". Four nouns, in her order, and every one of them is a thing you
 * can hold rather than a thing you have. That is the whole boundary: this is the
 * paperwork of being seen, not a record of what is wrong with her.
 */
export const CARE_SUBTITLE = 'Letters, numbers, references, emails';

/** The section a care record is filed under, on screen and in the prompt. */
export const CARE_SECTION = 'How I Access Care';

/**
 * Where it sits: inside the existing Health section rather than beside it.
 *
 * Her reasoning for not making it its own top-level section is above. One
 * section in the list, two groups inside it when she opens it: what she follows,
 * then the paperwork underneath.
 */
export const CARE_PARENT_SECTION = 'Health';

/**
 * The one line that tells a model what belongs here.
 *
 * SAID THE SAME WAY EVERYWHERE, because this is the description that stops a
 * consultant letter being treated like a skincare routine - which is the fault
 * the whole Care record exists to fix, and which came from a description, not
 * from the data.
 */
export const CARE_DESCRIPTION =
  'the admin of getting care: numbers, emails and letters. References you may be asked for at a reception desk or on the telephone, who you are under and how to reach them, what was agreed, when you are next seen, and the route back in. It is not a symptom diary and not a record of what is wrong with you.';
