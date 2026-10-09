// SPEAKING THE REPLY WHILE IT IS STILL BEING WRITTEN.
//
// Ruth, 28 September 2026: "Yes, stream the spoken reply, behind a switch so it
// can be turned off in one step."
//
// WHY THERE IS A SINK RATHER THAN A STREAMING RESPONSE. The voice adapter calls
// `ask-selodia` IN PROCESS - it imports the route's POST and hands it a
// NextRequest - so the two halves already share a heap. Turning the route's
// reply into a streaming Response would mean restructuring everything it does
// after the reply exists: the offer line, the allergy gate, the one-reply-per-
// turn insert. All of that is load-bearing and none of it is about streaming.
//
// So the route's shape does not change at all. It still assembles the whole
// reply, gates it, stores it and returns its JSON. What changes is that the
// words are ALSO pushed here as the model produces them, and the adapter is
// already speaking them by the time the JSON arrives.
//
// NOTHING IS SPOKEN UNTIL THE ROUTE SAYS SO. Text pushed here is buffered and
// silent. `open()` is called at the one point in the route where the reply is
// known to be the reply - the guess held, the turn is ordinary, the allergy gate
// cannot arm - and only then is anything emitted. Everything buffered up to that
// moment is flushed first, so opening late costs nothing.
//
// THE ONE THING THIS CANNOT UNDO. Once `open()` has been called and words have
// gone out, they have been spoken. If the model's stream then fails or truncates
// mid-sentence, the person hears half a sentence - there is no taking it back.
// That is the price of the two seconds, and it is why `open()` is deliberately
// hard to reach.

export type VoiceSink = {
  /** A text delta from the model. Buffered, and silent until open(). */
  push: (text: string) => void;
  /** Commit: everything so far, and everything after, is spoken. */
  open: () => void;
  /** Whether open() has been called. The route asks before it relies on it. */
  isOpen: () => boolean;
  /**
   * The reply as it will actually be stored.
   *
   * Emits whatever of it has not been spoken yet - normally the offer line the
   * route appends - and closes. If the final text does not begin with what was
   * already spoken, nothing more is emitted and it is logged: the two have
   * diverged, and saying the rest would be saying the same thing twice.
   */
  finish: (finalText: string) => void;
  /** Nothing will be spoken from here. Close with silence. */
  abandon: () => void;
  /** For the adapter: the text as it arrives, ending when finish/abandon runs. */
  read: () => AsyncGenerator<string>;
};

export function createVoiceSink(): VoiceSink {
  let buffered = '';
  let emitted = '';
  let open = false;
  let closed = false;

  // A queue and a single waiter, which is all that is needed: there is exactly
  // one producer (the model stream) and one consumer (the adapter).
  const queue: string[] = [];
  let wake: (() => void) | null = null;

  const emit = (text: string) => {
    if (!text) return;
    emitted += text;
    queue.push(text);
    wake?.();
    wake = null;
  };

  return {
    push(text) {
      if (closed) return;
      buffered += text;
      if (open) emit(text);
    },

    open() {
      if (open || closed) return;
      open = true;
      // Everything written before the route committed. Flushed as one piece
      // rather than replayed delta by delta - the adapter chunks it for speech
      // itself, and the original token boundaries mean nothing to a listener.
      emit(buffered.slice(emitted.length));
    },

    isOpen() {
      return open;
    },

    finish(finalText) {
      if (closed) return;
      if (open) {
        if (finalText.startsWith(emitted)) {
          emit(finalText.slice(emitted.length));
        } else if (emitted.length > 0) {
          // The stored reply is not the one that was spoken. The gate is not
          // allowed to arm on a streamed turn and the guess is checked before
          // open(), so this should be unreachable - which is exactly why it is
          // logged rather than silently tolerated.
          console.log(
            'VOICE SINK: the final reply diverged from what was already spoken. ' +
              `Spoken ${emitted.length} chars, final ${finalText.length}. Saying no more.`
          );
        }
      }
      closed = true;
      wake?.();
      wake = null;
    },

    abandon() {
      if (closed) return;
      closed = true;
      wake?.();
      wake = null;
    },

    async *read() {
      for (;;) {
        while (queue.length > 0) yield queue.shift() as string;
        if (closed) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    },
  };
}

// HOW THE TWO HALVES FIND EACH OTHER.
//
// Keyed by the request object the adapter constructs and hands to the route, so
// there is nothing global to leak between concurrent turns and nothing to clean
// up: when the request is collected, so is the entry.
const sinks = new WeakMap<object, VoiceSink>();

export function attachVoiceSink(request: object, sink: VoiceSink): void {
  sinks.set(request, sink);
}

/** The sink for this request, or null for every turn that is not a spoken one. */
export function voiceSinkFor(request: object): VoiceSink | null {
  return sinks.get(request) ?? null;
}

// CUTTING A STREAM INTO THINGS WORTH SAYING.
//
// The model produces text a few characters at a time, and handing those straight
// to a voice would have it sounding out fragments of words. This holds them until
// a sentence has ended, which is the same rule the adapter's speakableChunks
// applies to a finished reply, and for the same reason.
//
// IT NEVER LOSES A CHARACTER, and that is not tidiness. The sink checks that what
// was spoken is a PREFIX of what was stored before it says the rest, so a
// splitter that quietly dropped the space after a full stop would make every
// multi-sentence reply look like a divergence - and the offer line at the end of
// it would never be spoken. The first version did exactly that.
/**
 * The shortest thing worth handing to a voice on its own.
 *
 * Cutting at every comma would hand the voice "Yes," on its own, which sounds
 * like a fault. Waiting for a long one means never cutting at all.
 *
 * SIXTY WAS THE FIRST GUESS AND IT WAS TOO HIGH: the opening clause of a real
 * reply - "Food is logged three of three days this week," - is forty-three
 * characters, so a sixty-character floor would have left the eager cut doing
 * nothing on exactly the replies it was added for. Thirty-five is about two
 * thirds of a second of speech and clears "Yes," and "Food's logged," by a
 * wide margin.
 */
const MIN_CLAUSE = 35;

export function splitSpeakable(
  pending: string,
  // CUT AT CLAUSES TOO, not only at sentences.
  //
  // Waiting for a full stop bought almost nothing. Measured across ten real
  // turns on 28 September 2026: 124ms on the median turn, 806ms on the best,
  // against a prediction of about two seconds. The prediction was wrong in a
  // specific way worth remembering - it assumed the writer's output would be
  // spread across the wait, when almost all of the wait happens BEFORE the first
  // sentence exists. There was nothing to say early because nothing had been
  // written yet.
  //
  // So the cut moves earlier, to a comma, semicolon, colon or dash with at least
  // a phrase in front of it. The pauses it introduces fall where a person pauses
  // anyway.
  { eager = false }: { eager?: boolean } = {}
): { cuts: string[]; rest: string } {
  const cuts: string[] = [];
  let rest = pending;
  for (;;) {
    // A terminator followed by whitespace, or one at the very end of what has
    // arrived so far. Anything else is mid-sentence and waits.
    let at = rest.search(/[.!?\n]\s|[.!?]$/);

    // No sentence yet, but perhaps a clause long enough to be worth saying. The
    // clause mark must be FOLLOWED by whitespace, so a comma the model is still
    // typing past is not mistaken for the end of anything.
    if (at < 0 && eager) {
      const clause = rest.search(/[,;:—]\s/);
      if (clause >= MIN_CLAUSE) at = clause;
    }

    if (at < 0) break;
    cuts.push(rest.slice(0, at + 1));
    rest = rest.slice(at + 1);
  }
  return { cuts, rest };
}

// UNITS, SAID THE WAY A PERSON SAYS THEM.
//
// Ruth, 9 October 2026: "it hilariously says 'Kay-CALS' and 'GEEs' for kcal and
// grams. Can we make her say calories and grams, it's way more conversational,
// bit odd like that, jarring almost."
//
// She is right, and the reason it happens is that "kcal" and "25g" are written
// for the eye. On a screen they are compact and obvious. Read aloud by a voice
// that has never seen them before, "kcal" becomes a word and "g" becomes a
// letter, and the sentence stops being something anybody would say.
//
// A TRANSFORM, NOT AN INSTRUCTION IN THE PROMPT. Telling the writer to spell
// units out would work most of the time, and most of the time is the wrong
// standard for something that happens in every reply about food. This runs on
// the text on its way to the voice and cannot be forgotten. It is the same
// reasoning as a guard at the write.
//
// SPOKEN ONLY. The reply that is STORED and shown on screen keeps "350 kcal and
// 25g", because that is the right form for the eye and it is what the Log, the
// reports and the rest of the app already use. Only what goes to the speaker
// changes.
//
// SAFE TO RUN ON A CHUNK. The adapter cuts the stream at sentence and clause
// boundaries before anything is spoken, so a unit is never split across two
// pieces of text. A transform applied per delta would have had to worry about
// "25" arriving before "g"; this one does not.

/** Singular when there is exactly one of something, which is how people talk. */
function pluralise(value: string, one: string, many: string): string {
  return value === '1' ? one : many;
}

/**
 * The same sentence, written to be heard rather than read.
 *
 * Longer units are replaced before shorter ones, so "kg" and "mg" are consumed
 * before the bare "g" rule can see their last letter.
 */
export function forSpeech(text: string): string {
  return (
    text
      // "350 kcal" and "350kcal" both become "350 calories". The unit carries
      // no number of its own, so there is no singular to worry about.
      .replace(/\bkcals?\b/gi, 'calories')
      .replace(/(\d+(?:\.\d+)?)\s*kg\b/g, (_m, n: string) => `${n} ${pluralise(n, 'kilo', 'kilos')}`)
      .replace(/(\d+(?:\.\d+)?)\s*mg\b/g, (_m, n: string) => `${n} ${pluralise(n, 'milligram', 'milligrams')}`)
      .replace(/(\d+(?:\.\d+)?)\s*ml\b/gi, (_m, n: string) => `${n} ${pluralise(n, 'millilitre', 'millilitres')}`)
      // Only after a number, so an ordinary word ending in g is untouched.
      .replace(/(\d+(?:\.\d+)?)\s*g\b/g, (_m, n: string) => `${n} ${pluralise(n, 'gram', 'grams')}`)
      // Capital L only: a lower-case "l" after a number is far more often a
      // typo or a list marker than a litre.
      .replace(/(\d+(?:\.\d+)?)\s*L\b/g, (_m, n: string) => `${n} ${pluralise(n, 'litre', 'litres')}`)
      // "35-40 grams" reads better than "35 to 40 grams" on screen and worse
      // aloud, where a hyphen between two numbers is silence.
      .replace(/(\d)\s*-\s*(\d)/g, '$1 to $2')
  );
}
