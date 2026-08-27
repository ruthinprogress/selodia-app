// Saying so when a log did not land.
//
// WHY THIS EXISTS. Found live on 2026-08-27: Ruth typed "Waist 70cm / Thighs
// 52.5cm" and Unflump replied "Got those down". Nothing was stored - waist and
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
// note already appended in ask-unflump for a deletion, and for the same reason:
// a fact about someone's stored data is the app's to state, never the model's
// to promise.
//
// TONE. Ruth's wording (2026-08-27, second pass). The first draft - "Nothing
// from that reached your log, though - say it again if you'd like it kept" -
// was too blunt and too bossy: it stated a fact and then issued an instruction,
// at the moment someone has just told Unflump something about their body and is
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
  intent: 'none' | 'food' | 'activity' | 'measurement';
  // Plain names of what genuinely reached the database this turn. Empty means
  // nothing did.
  landed: string[];
  // Plain names of things the message stated that did NOT land, when we know
  // them specifically. Empty is normal - a whole-message miss is carried by
  // `landed` being empty instead, since we often cannot name what was lost.
  missed: string[];
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
export function unsavedNote(attempt: LogAttempt): string | null {
  const { intent, landed, missed } = attempt;

  // Nothing was being logged, so nothing can have gone missing.
  if (intent === 'none' && missed.length === 0) return null;

  // Part of it landed and we can name what didn't. The specific case, and the
  // one the two-table split makes common: a weight saves while a waist does not.
  if (landed.length > 0 && missed.length > 0) {
    const plural = missed.length > 1;
    return (
      `Hmm, it looks like the ${list(missed)} didn't save for some reason. ` +
      `Would you mind re-entering ${plural ? 'those' : 'it'} so we can make sure ` +
      `${plural ? "they're" : "it's"} properly logged for you?`
    );
  }

  // Something landed and nothing is known to be missing: silence is right.
  if (landed.length > 0) return null;

  // A whole-message miss. "that entry" rather than naming anything, because in
  // this branch we genuinely do not know what was lost.
  return (
    "Hmm, it looks like that entry didn't save for some reason. " +
    'Would you mind re-entering it so we can make sure it\'s properly logged for you?'
  );
}
