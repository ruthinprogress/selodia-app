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
  // "noted" AS A CONFIRMATION, not as a date.
  //
  // This was `/\bnoted\b/` and on 30 September it fired on "the freckle merging
  // noted back in June" - her own phrase about when something was observed - so
  // a proposal that claimed nothing got a correction stapled to it. A word is
  // not a claim; a word in a position is.
  //
  // Matches "…, noted." at the end of a sentence, and "duly noted". Never
  // "noted back in June", "noted months ago", "you noted".
  /(?:^|[,;]\s*|\s)noted\s*[.!]?\s*$/im,
  /\bduly noted\b/i,
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
  // "KEPT IN YOUR ME TAB", WHICH IS THE APP'S OWN SENTENCE (2026-10-01).
  //
  // Ruth: "Fix the duplicate, it feels broken." On the turn where she says yes,
  // the reply arrived as:
  //
  //   Kept in your Me tab, under Medications.
  //
  //   Kept in your Almanac, under Me.
  //
  // The second line is saveAppliedNote - the app, which is the only thing that
  // knows the write happened. The FIRST is the model, which has seen that exact
  // house phrasing in its own history and copied the style. The same mechanism
  // as the escaped-newline bug below: the model learns from what it said last
  // time, including the parts that were never its to say.
  //
  // "Kept" was the one confirmation verb this list did not have, which is why
  // the sentence sailed through while "saved", "added" and "logged" were caught.
  //
  // DELIBERATELY THE WHOLE SHAPE, NOT THE BARE WORD. "Nothing is kept until you
  // agree" is on the medication screen and in the panel's own intro, and it is a
  // promise rather than a claim - stripping it would delete the sentence that
  // makes the feature trustworthy. So this matches only a destination being
  // asserted: kept IN somewhere.
  /\bkept\s+(?:it\s+|that\s+|these\s+|them\s+)?(?:in|on|to)\s+(?:your|the)\b/i,
  /\bi(?:'ve| have)\s+kept\b/i,
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
  /\b(?:added|saved|logged|updated|noted|kept)\s+(?:nothing|none)\b/i,
  /\b(?:haven't|have not|hasn't|has not|didn't|did not|won't|will not|cannot|can't|not)\s+(?:yet\s+)?(?:been\s+)?(?:added|saved|logged|updated|noted|kept)\b/i,
  // Hers, not the app's.
  /\byou(?:'ve| have)?\s+(?:already\s+)?(?:added|saved|logged|updated|noted|kept)\b/i,
  // THE PROMISE, WHICH MUST SURVIVE (2026-10-01).
  //
  // "Nothing is kept until you have seen it written down and agreed" is on the
  // medication screen; "Nothing is saved until you say yes" is the setup chat
  // panel's own intro. These are the sentences the whole confirm-first design
  // rests on, and each contains a confirmation verb while asserting the exact
  // opposite of a confirmation.
  //
  // THE NEGATION RULE ABOVE DID NOT COVER THEM, and that was a live fault rather
  // than a gap I introduced: it matches the VERB followed by "nothing"
  // ("saved nothing"), and every one of these puts the "nothing" FIRST. So the
  // app's own promise read as a claim that something had been written, and
  // would have been deleted out of a reply that repeated it.
  /\bnothing (?:is|was|has been|gets|will be)\s+(?:added|saved|logged|updated|noted|kept)\b/i,
  // "...until you say yes", "...until you agree" - the condition IS the promise.
  /\b(?:added|saved|logged|updated|noted|kept)\s+until\b/i,
];

/**
 * A QUESTION IS NOT A CLAIM.
 *
 * "Shall I save it this way?" is the app asking permission, and on 30 September
 * a correction was appended to exactly that - so the offer and its retraction
 * arrived in the same message, and she was told nothing had been saved before
 * she had even been asked.
 */
const IS_AN_OFFER = /\b(?:shall i|would you like|want me to|do you want me to|should i)\b[^.?!]*\?/i;

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
  // A reply that ASKS to save has not claimed to have saved.
  if (IS_AN_OFFER.test(reply)) return null;
  for (const sentence of sentences(reply)) {
    if (NOT_A_CLAIM.some((re) => re.test(sentence))) continue;
    if (CLAIMS.some((re) => re.test(sentence))) return sentence;
  }
  return null;
}

/**
 * REMOVE THE CLAIM RATHER THAN ARGUE WITH IT.
 *
 * Ruth, 30 September: the guard "contradicts the app's own confirmation in the
 * same message". She is right, and appending was the wrong shape from the
 * start - it produced "That's saved to your Me tab." followed immediately by "I
 * need to correct that: nothing was saved", which is two voices disagreeing in
 * front of her about her own record.
 *
 * The prompt has told the model since 27 September never to say something is
 * saved (NO_RECEIPTS: "the app shows its own save confirmation"), and it says
 * it anyway. So the sentence comes out. What remains is what the model actually
 * said to her, and the app adds its own confirmation only when a write really
 * happened.
 *
 * ONE VOICE, and it is the app's, for the one thing only the app knows.
 */
export function stripSaveClaims(reply: string): string {
  if (IS_AN_OFFER.test(reply)) return reply;
  if (!claimsAWrite(reply)) return reply;

  // LINE BY LINE, KEEPING THE SHAPE.
  //
  // The first version split the whole reply into sentences and rejoined the
  // survivors with a space. That flattened every list she is meant to be able
  // to glance at - "Morning / - Niacinamide ... / Evening (alternating) / ..."
  // became one paragraph - and it ran on every reply rather than only the ones
  // that claimed something.
  //
  // So: nothing is touched unless there is a claim, and a line loses only the
  // sentences that make one. Blank lines and indentation survive, because they
  // are the difference between a list and a wall.
  const lines = reply.split('\n').map((line) => {
    if (!line.trim()) return line;
    const kept = line
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => {
        if (NOT_A_CLAIM.some((re) => re.test(sentence))) return true;
        return !CLAIMS.some((re) => re.test(sentence));
      })
      .join(' ')
      .trim();
    return kept;
  });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * A REPLY MUST NOT CONTAIN THE TWO CHARACTERS BACKSLASH-N.
 *
 * Ruth, 30 September 2026: a proposal arrived reading
 *
 *   "Here's the update to your Skincare Routine card:\n\nMorning\n- Niacinamide…"
 *
 * with the escapes visible as text. The shape is exactly the `content` string
 * from the proposedSave object that leaked into her thread earlier the same
 * day - which is still sitting in her history as an assistant turn, so the
 * model had an example of itself writing escaped newlines and copied it.
 *
 * The cause is being fixed where it belongs, by cleaning history before the
 * model sees it. This is the display guard, and it is safe because no honest
 * reply ever needs the literal two-character sequence: a real line break is a
 * real line break.
 */
export function unescapeNewlines(reply: string): string {
  if (!reply.includes('\\n')) return reply;
  return reply.replace(/\\r\\n|\\n/g, '\n').replace(/\\t/g, ' ');
}

/**
 * MACHINE OUTPUT NEVER REACHES HER (2026-09-30).
 *
 * On 30 September her reply began:
 *
 *   {"proposedSave": {"type": "me", "title": "Skincare Routine", "content": ...}}
 *
 *   That's saved to your Me tab.
 *
 * CAUSE, and it was mine, made that morning. The block listing her Me cards
 * carries an instruction for the CLASSIFY call - "offer it with proposedSave
 * type 'me'" - and I handed that block to the model that writes her replies,
 * which has no tool to put a proposedSave into. It did the only thing it could
 * and typed the JSON into the message.
 *
 * The real fix is upstream: the writer is given facts and the classifier is
 * given instructions, built separately. This is the second line of defence,
 * because the first one is a discipline about which block goes where and any
 * future edit can break it again - and the failure is not subtle for her, it is
 * a wall of braces above a sentence about her skin.
 *
 * DELIBERATELY BLUNT. It removes a leading JSON object and any fenced block
 * that contains one of the field names this app's tools use. It does not try to
 * parse or repair: whatever was in there was never meant for her, and a reply
 * that loses a sentence is better than one that shows her the plumbing.
 */
const MACHINE_FIELDS =
  /"(?:proposedSave|almanacKind|almanacTitle|almanacContent|meUpdate|noteText|saveAnswer|workoutPlan|proposedFatFocus|proposedMuscleFocus)"/;

export function stripMachineOutput(reply: string): string {
  let out = reply;

  // A fenced block whose contents name one of our fields.
  out = out.replace(/```[a-z]*\s*([\s\S]*?)```/gi, (whole, inner) =>
    MACHINE_FIELDS.test(String(inner)) ? '' : whole
  );

  // A bare JSON object at the start, or on its own lines anywhere. Balanced
  // scanning rather than a greedy regex, so a brace inside her own text cannot
  // swallow the rest of the reply.
  let guard = 0;
  while (guard < 5) {
    guard += 1;
    const start = out.indexOf('{"');
    if (start === -1) break;
    let depth = 0;
    let end = -1;
    for (let i = start; i < out.length; i += 1) {
      if (out[i] === '{') depth += 1;
      else if (out[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) break;
    const candidate = out.slice(start, end + 1);
    if (!MACHINE_FIELDS.test(candidate)) break;
    out = (out.slice(0, start) + out.slice(end + 1)).trim();
  }

  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * THE APP NEVER DISOWNS THE APP (2026-09-30).
 *
 * Ruth's phone, 2:27pm. She said "Nothing there" and was told:
 *
 *   "That's on me for saying it would show up - I don't control that, only the
 *   app does. If it's not appearing on your Me tab, worth trying the add once
 *   more or giving the app a moment; I'm not able to check what's actually
 *   stored there."
 *
 * Her reading of it, which is the one that counts: "she IS the app and
 * supposedly the authority on it, so that's just terrible to hear she washes
 * her hands of the actual data she's supposedly working with. Destroys trust."
 *
 * IT IS ALSO UNTRUE. Her Me cards are in the record handed to the writer on
 * every turn. It could check. It said it could not.
 *
 * WHY A GUARD AND NOT JUST THE PROMPT SENTENCE. The prompt now says this in
 * INSIDE_THE_APP, and the prompt has said "never claim a save" since 27
 * September and the model claims saves anyway - which is the whole argument
 * behind stripSaveClaims above. A rule that matters twice belongs in code.
 *
 * NARROW ON PURPOSE. "I'm not a doctor", "that didn't save", "I can't add an
 * item to a meal yet" are all honest limits and none of them match: what is
 * caught is the app pointing at some OTHER party, or claiming it cannot see
 * what is sitting in front of it.
 */
const DISAVOWALS: RegExp[] = [
  // Pointing at somebody else.
  /\bi (?:don't|do not|can't|cannot) control\b/i,
  /\bonly the app\b/i,
  /\bthe app (?:does|controls|handles|decides|knows) that\b/i,
  /\bthat(?:'s| is) (?:the app's|not my) (?:job|doing|department|side|end)\b/i,
  /\bfrom (?:my end|here),? i (?:can't|cannot)\b/i,
  // Telling her to wait and try again, which is a helpdesk answer.
  /\bgiv(?:e|ing) (?:the app|it) a (?:moment|minute|second)\b/i,
  // Claiming it cannot see what it was given.
  /\bi (?:can't|cannot|am not able to|'m not able to) (?:see|check|access|read) your (?:me tab|record|almanac|log|data)\b/i,
  /\bi have no (?:visibility|access) (?:into|to)\b/i,
  /\b(?:i(?:'m| am) not able to|i (?:can't|cannot|couldn't)|i have no way (?:to|of)|i don't have (?:a way|any way|visibility))\s[^.!?]{0,30}\b(?:see|check|read|access|tell|know)\b[^.!?]{0,20}\bwhat(?:'s| is| was)?\b[^.!?]{0,30}\b(?:stored|saved|in there|on your|in your)\b/i,
];

/**
 * The first sentence in which the app disowns the app, or null.
 */
export function disavowsTheApp(reply: string): string | null {
  for (const sentence of sentences(reply)) {
    if (DISAVOWALS.some((re) => re.test(sentence))) return sentence;
  }
  return null;
}

/**
 * What is left when every disavowal is removed.
 *
 * WHEN NOTHING IS LEFT, which is what her turn would have been - the whole
 * reply was the disavowal - this stands in. It claims nothing, points at
 * nobody, and asks the one question that gets the next turn answered from the
 * record it actually has.
 */
const NOTHING_LEFT = 'I can see your record, so let me answer from it. What were you expecting to find?';

export function stripDisavowal(reply: string): string {
  if (!disavowsTheApp(reply)) return reply;

  // Line by line, same shape as stripSaveClaims: a list must survive.
  const lines = reply.split('\n').map((line) => {
    if (!line.trim()) return line;
    return line
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => !DISAVOWALS.some((re) => re.test(sentence)))
      .join(' ')
      .trim();
  });

  const kept = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return kept || NOTHING_LEFT;
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
    return `That did not save. I can't ${outcome.cannot} yet.`;
  }
  // NOT "your log". A Me card is not a log, and being told a skincare routine
  // failed to reach "your log" is the app describing her record in a word she
  // would not use for it.
  return 'That did not save, so it is not in your record.';
}
