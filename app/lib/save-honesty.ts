// Saying so when a log did not land.
//
// WHY THIS EXISTS. Found live on 2026-08-27: Ruth typed "Waist 70cm / Thighs
// 52.5cm" and Selodia replied "Got those down". Nothing was stored - waist and
// thigh have no field in the measurement parser - and the storage layer behaved
// correctly in refusing to write an empty row. The failure was that the reply
// had already been written: the model composes its answer BEFORE the save is
// attempted, so it cannot know the outcome, and the prompt telling it not to
// claim a save is an instruction it can simply not follow. She re-entered the
// same numbers two hours later, because the only signal that nothing had been
// kept was the ABSENCE of a save toast.
//
// So this is deterministic code, not a prompt rule - the same split the safety
// state machine draws (SAFETY_ARCHITECTURE.md §1): the model writes the reply,
// the app states what actually happened to the data. It mirrors the correction
// note already appended in ask-selodia for a deletion, and for the same reason:
// a fact about someone's stored data is the app's to state, never the model's
// to promise.
//
// TONE. Ruth's wording (2026-08-27, second pass). The first draft - "Nothing
// from that reached your log, though - say it again if you'd like it kept" -
// was too blunt and too bossy: it stated a fact and then issued an instruction,
// at the moment someone has just told Selodia something about their body and is
// being told it did not stick. Hers opens with a softener, ASKS rather than
// tells, and puts the app on the person's side of it ("so we can make sure").
//
// "for some reason" is load-bearing, not filler: it says out loud that we do
// not know why, which is the truth. The causes differ - an unparseable number, a
// metric with nowhere to go, a failed insert - and a confident wrong explanation
// is the exact failure this module exists to stop.

export type LogAttempt = {
  // What the model classified this message as. 'none' means no log was intended,
  // so there is nothing to be honest about.
  intent: 'none' | 'food' | 'activity' | 'measurement' | 'hydration' | 'sleep' | 'personal_metric' | 'cycle' | 'feeling';
  // Plain names of what genuinely reached the database this turn. Empty means
  // nothing did.
  landed: string[];
  // Plain names of things the message stated that did NOT land, when we know
  // them specifically. Empty is normal - a whole-message miss is carried by
  // `landed` being empty instead, since we often cannot name what was lost.
  missed: string[];
  /**
   * Did a writer actually TRY to store something and fail?
   *
   * Ruth, 27 September 2026, item 6. She logged two black coffees, and then
   * asked "The two black coffees, you mean?" - and got one message saying both
   * "that's logged fine, no need to repeat it" AND "it looks like that entry
   * didn't save for some reason. Would you mind re-entering it?". She repeated
   * it and got the identical pair back. It looped.
   *
   * Nothing had failed. Her QUESTION was classified as a drink log, the writer
   * looked for a drink in "The two black coffees, you mean?", correctly found
   * nothing to store, and `landed` stayed empty - which this module read as a
   * save that had gone missing. Meanwhile the model was answering about the
   * EARLIER log, which really had saved. Two components answering two different
   * questions in one message, and both of them right.
   *
   * The distinction was already in the code and was not being used: a writer
   * THROWS when a write fails and returns null when there is nothing to write.
   * So this is set only in the catch, and a message that simply had nothing in
   * it can no longer be reported as a loss.
   */
  attempted: boolean;
};

function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// The line to append to the reply, or null when there is nothing honest to add.
//
// Null in the ordinary case matters: a note on every successful log would be
// the "Logged: ..." receipt the voice rules exist to prevent. This speaks only
// when something the person said did not survive the turn.
// When the duration gate refused an activity, specifically.
//
// unsavedNote says "for some reason" because it usually does not know the
// reason, and this module's whole argument is that a confident wrong
// explanation is the failure. Here we DO know: logActivityFromText returned
// nothing because the description never said how long. Saying that is not a
// guess, it is the actual cause, and the one thing that fixes it is three words
// the person can type back.
//
// It also has to say that nothing was saved. The model has already written its
// reply by this point and may well have congratulated them on the run - so this
// line is the only thing in the turn that knows the run is not in the table.
export function needDurationNote(): string {
  return "I haven't saved that one yet. How long did it last?";
}

export function unsavedNote(attempt: LogAttempt): string | null {
  const { intent, landed, missed } = attempt;

  // Nothing was being logged, so nothing can have gone missing.
  if (intent === 'none' && missed.length === 0) return null;

  // Part of it landed and we can name what didn't. The specific case, and the
  // one the two-table split makes common: a weight saves while a waist does not.
  if (landed.length > 0 && missed.length > 0) {
    const plural = missed.length > 1;
    // ITEM 6's FIX HAD ONLY REACHED THE OTHER BRANCH (found 27 September 2026,
    // testing the new reply path). This one still said "Would you mind
    // re-entering it so we can make sure it's properly logged for you?" - which
    // is the exact sentence Ruth reported, and this is the COMMON case, not the
    // rare one: a weight saves while a waist does not, because they go to two
    // different tables.
    //
    // The app has her words and has already retried with them, so asking her to
    // type them again asks her to repeat the thing that just failed. It says
    // what happened, once, and names what is missing so she knows which part.
    return (
      `The ${list(missed)} didn't save, and I've tried twice. ` +
      `${plural ? 'Those are' : "That's"} not in your log, so ${plural ? 'they are' : 'it is'} worth another go in a moment.`
    );
  }

  // Something landed and nothing is known to be missing: silence is right.
  if (landed.length > 0) return null;

  // NOTHING WAS EVEN ATTEMPTED, so nothing was lost. This is the coffee loop:
  // a question ABOUT a log is not a log, and a writer finding nothing to store
  // is the correct outcome rather than a failure to report.
  if (!attempt.attempted) return null;

  // A whole-message miss, and this time something genuinely did fail.
  //
  // IT NO LONGER ASKS HER TO TYPE IT AGAIN (item 6). The app has her words and
  // has already retried with them, so asking would be asking her to repeat the
  // thing that just did not work - which is precisely what she did, twice,
  // getting the same answer both times. It says what happened, once.
  return (
    "That one didn't save, and I've tried twice. " +
    'None of it is in your log, so it is worth another go in a moment.'
  );
}
