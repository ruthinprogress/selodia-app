// A PHOTO SHE SENT WITH NO WORDS.
//
// Ruth, 12 October 2026: "the chat doesn't process any document I give it. It
// should be able to receive any image and decipher it like a normal Claude
// chat." And, rejecting a first design that would have made her type a question
// to get a proper answer: "Even with no question, Selodía should extract the
// details and ask if not sure."
//
// THE FAULT, IN ONE ROUTE. classify-image shows the photo to a model and keeps
// one word of what it said - food, body_measurement, activity, document, unclear.
// Everything else the model saw is thrown away. So "unclear" was never the model
// failing to understand a picture; it was the app having nowhere to put
// understanding, and it ended in "I couldn't quite make that out".
//
// WHAT HAPPENS NOW. A photo the classifier cannot place goes into the
// conversation as her message, with the image attached, through the same
// storage and attachment path "Ask about this" already uses. Both models see it.
// The writer says what it can see and asks one question.
//
// NOTHING IS SAVED FROM IT ON THAT TURN, and that is enforced HERE rather than
// asked for in a prompt. "A guard belongs at the write": the classifier is told
// not to save, and then the verdict is cut down to an allowlist before any write
// code reads it. An allowlist rather than a list of things to remove, because the
// verdict has sixty fields and gains more - a field added next month is stripped
// on a photo turn by default, instead of quietly writing from a picture nobody
// confirmed.

/**
 * What her bubble and the stored row say when there were no words.
 *
 * Never shown: the thread hides it whenever the row has an image. It exists
 * because the model needs non-empty text beside an image, and putting words in
 * her mouth ("what is this?") would be the app speaking for her.
 *
 * MUST MATCH mobile/src/lib/photo-turn.ts - check-photo-turn.mjs asserts it.
 */
export const PHOTO_ONLY_MESSAGE = '[photo]';

/**
 * The verdict fields that survive a photo turn. Safety and conversation only.
 *
 * `classification` stays above everything else: a photo can carry distress as
 * surely as words can, and the safety path must judge it as it would any turn.
 */
const KEEP_ON_A_PHOTO_TURN = new Set([
  'classification',
  'reply',
  'resourceCardTitle',
  'resourceCardDescription',
  'healthGuidanceApplied',
  'revisitingPriorDisclosure',
  'clarificationAsked',
]);

/**
 * Cut a classifier verdict down to what a photo turn may act on.
 *
 * Mutates and returns the same object, because the route holds it as a const
 * and reads it in a hundred places afterwards.
 */
export function photoOnlyVerdict<T extends object>(result: T): T {
  const r = result as Record<string, unknown>;
  for (const key of Object.keys(r)) {
    if (!KEEP_ON_A_PHOTO_TURN.has(key)) delete r[key];
  }
  r.logIntent = 'none';
  return result;
}

/** For the classifier, which is the model with the tools. */
export const PHOTO_ONLY_CLASSIFIER_NOTE = `THIS TURN IS A PHOTO WITH NO WORDS. Their message reads ${PHOTO_ONLY_MESSAGE} and the photo is attached to it. Do not log, save, correct, remember or set anything from it on this turn: the reply will say what is in it and ask what they want first, and anything they then confirm is saved on the next turn. Judge safety exactly as you would for any message.`;

/**
 * For the writer, which is the model that speaks to her.
 *
 * Longer than a sentence or two, deliberately. The reply prompt allows more
 * "when it is genuinely wanted", and somebody who has handed over a photo of a
 * letter wants to know what it says.
 */
export const PHOTO_ONLY_WRITER_BLOCK = `THEY HAVE SENT A PHOTO WITH NO WORDS. It is attached to their message. Look at it properly and tell them plainly what you can see, including any words, numbers, names or dates on it that matter. Then ask ONE question about what they would like. If it looks like something that could be logged - a meal, a scale reading, a workout - say what you would log and ask before doing it. If it is a letter, a result, a prescription or a label, offer to go through what it means for them. Nothing has been saved from it. If no photo is actually attached, it did not come through: say so simply and ask them to send it again.`;
