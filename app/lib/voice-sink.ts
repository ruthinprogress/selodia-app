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
