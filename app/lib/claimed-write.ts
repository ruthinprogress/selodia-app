// THE APP MAY ONLY SAY IT SAVED SOMETHING IF IT SAVED SOMETHING.
//
// Ruth, 30 September 2026: "chat may only say added, noted, saved or updated
// when a write succeeded this turn; otherwise it says plainly what it can't do."
//
// THE CASE THAT JUSTIFIES IT, and it is a real one rather than a worry. On 29
// September at 20:23 she said "Oh please add", meaning two spoons of peanut
// butter into the yoghurt bowl she had logged. The reply was "Two spoons of
// peanut butter added to the yoghurt bowl, noted." Nothing was written:
//
//   the dinner entry's raw_text and all five of its food_items carry no
//   peanut butter, and nothing at all was created in food_logs or food_items
//   between 20:22 and 20:27.
//
// WHY save-honesty.ts DID NOT CATCH IT. That module speaks when a writer TRIED
// and failed - `attempted` is set in the catch. Here nothing tried, because
// adding an item to an already-saved meal was not something the app could do at
// all. No writer ran, no writer threw, `landed` was empty for the ordinary
// reason that there was nothing to write, and the module correctly stayed
// quiet. That silence is right for a question about a log and wrong for an
// instruction to change one, and nothing could tell the two apart.
//
// So this looks at the REPLY. Not at what was attempted - at what was claimed.
// If the sentence says the app did something to her record, and nothing reached
// her record, the sentence is false whatever the pipeline believed.
//
// WHY NOT JUST FIX THE PROMPT. Because save-honesty.ts already carries the
// argument, from the first time this happened in August: "the model composes
// its answer BEFORE the save is attempted, so it cannot know the outcome, and
// the prompt telling it not to claim a save is an instruction it can simply not
// follow."

/**
 * Phrases in which the APP claims to have changed her record.
 *
 * NARROW ON PURPOSE, and the narrowness is the hard part. "That's logged fine,
 * no need to repeat it" is a true sentence about an EARLIER turn, and treating
 * it as a claim about this one produced the coffee loop of 27 September: two
 * contradictory sentences in one reply, both technically generated correctly.
 *
 * So these all require the app to be the actor, in the present or the just-now:
 * "added", "I've saved", "noted", "got that down". A sentence about a log that
 * already exists does not match, because it is not claiming to have made one.
 */
const CLAIMS: RegExp[] = [
  // "noted", "duly noted", "... , noted." - the peanut butter reply.
  /\bnoted\b/i,
  // "added to", "I've added", "adding that"
  /\b(?:i(?:'ve| have)\s+)?added\b/i,
  // "saved", "I've saved", "that's saved"
  /\b(?:i(?:'ve| have)\s+)?saved\b/i,
  // "updated", "I've updated"
  /\b(?:i(?:'ve| have)\s+)?updated\b/i,
  // "got that down", "got those down" - the August wording.
  /\bgot (?:that|those|it|them) down\b/i,
  // "put that in", "popped that in"
  /\b(?:put|popped) (?:that|those|it|them) in\b/i,
  // "I've logged", "logged it" - but NOT "that's logged" or "already logged",
  // which are statements about an existing entry.
  /\bi(?:'ve| have)\s+logged\b/i,
  /\blogged (?:it|that|those|them)\b/i,
];

/**
 * Sentences that contain a claim word and are not a claim.
 *
 * Three kinds, and the checks found the last two - I had only thought of the
 * first:
 *
 *   ABOUT AN EXISTING LOG. "That's logged fine, no need to repeat it" is true
 *   and is about an earlier turn. Correcting it produced the coffee loop of 27
 *   September: one reply saying both that something was logged and that it was
 *   not.
 *
 *   NEGATED. "I have added nothing yet" contains "added" and says the opposite.
 *   A guard that reads a denial as a claim would contradict the app agreeing
 *   with it.
 *
 *   SOMEBODY ELSE'S DOING. "You logged that one yourself on Monday" is about
 *   HER action, not the app's. The verb is the same word; the actor is not.
 */
const NOT_A_CLAIM: RegExp[] = [
  // About an existing log.
  /\balready\b/i,
  /\bis (?:already )?(?:in|on) your log\b/i,
  /\bthat(?:'s| is) logged\b/i,
  /\bno need to (?:repeat|re-?enter)\b/i,
  // Negated.
  /\b(?:added|saved|logged|updated|noted)\s+(?:nothing|none)\b/i,
  /\b(?:haven't|have not|hasn't|has not|didn't|did not|won't|will not|cannot|can't|not)\s+(?:yet\s+)?(?:been\s+)?(?:added|saved|logged|updated|noted)\b/i,
  // Hers, not the app's.
  /\byou(?:'ve| have)?\s+(?:already\s+)?(?:added|saved|logged|updated|noted)\b/i,
];

/** Split into sentences so one true clause cannot excuse a false one. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The first sentence in which the app claims to have changed her record, or
 * null. Returned rather than a boolean so a caller can quote it.
 */
export function claimsAWrite(reply: string): string | null {
  for (const sentence of sentences(reply)) {
    if (NOT_A_CLAIM.some((re) => re.test(sentence))) continue;
    if (CLAIMS.some((re) => re.test(sentence))) return sentence;
  }
  return null;
}

export type WriteOutcome = {
  /** The reply the model wrote. */
  reply: string;
  /** Plain names of everything that genuinely reached the database this turn. */
  wrote: string[];
  /**
   * What the app knows it cannot do, when it knows. Supplied by the caller that
   * recognised the instruction and had no route for it - "add an item to a meal
   * that is already logged". Null means we do not know why, and the note says
   * so rather than inventing a reason.
   */
  cannot?: string | null;
};

/**
 * The line to append when the reply claimed a write that did not happen.
 *
 * Null in every other case, including the ordinary one where something really
 * was written. A note on a successful save would be the receipt the voice rules
 * exist to prevent.
 *
 * IT CONTRADICTS THE SENTENCE ABOVE IT, and that is the point. The alternative
 * is rewriting the model's words, which means guessing what it meant to say;
 * this says what is true about her data and leaves the model's sentence
 * standing as the thing that was wrong. save-honesty.ts has worked this way
 * since August for the same reason: a fact about somebody's stored data is the
 * app's to state, never the model's to promise.
 */
export function falseClaimNote(outcome: WriteOutcome): string | null {
  if (outcome.wrote.length > 0) return null;
  const claim = claimsAWrite(outcome.reply);
  if (!claim) return null;

  if (outcome.cannot) {
    return `I need to correct that: nothing was saved. I can't ${outcome.cannot} yet.`;
  }
  return "I need to correct that: nothing was saved to your log just now, so that change isn't recorded.";
}
