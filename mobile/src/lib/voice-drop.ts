// WHY A VOICE SESSION ENDED, AND WHETHER SHE HEARD THE LAST THING SAID.
//
// Ruth, 27 September 2026: "add logging for SDK disconnect events, so next time
// we know whether the app, the SDK or I closed the session. If a session does
// drop, the next one should carry the thread forward rather than starting
// blank."
//
// WHAT THE LOGS COULD NOT TELL US. Eight conversations that morning, every one
// ending `Client disconnected: 1000` - a normal close from the app's side. That
// rules out a network failure and the platform's own 600-second limit, and
// rules in precisely nothing else: a deliberate tap and a clean SDK teardown
// look identical from the other end. The one thing that distinguishes them is
// only visible on the device, and the device was recording nothing.
//
// The cost of that gap was real. Her first sentence of the next session was "I
// actually didn't hear what you said about the knee" - the previous session had
// ended holding an answer she never heard.
//
// SO TWO THINGS ARE KEPT. Which side ended it, and whether the agent was
// speaking at the time. The second is what makes the next session useful rather
// than merely informed: an answer cut off mid-sentence is an answer she does
// not have, and the new session can offer it again instead of starting blank.
//
// IN MEMORY, NOT ON DISK. This describes the session that just ended, for the
// one that starts next. Surviving a restart of the app would mean offering to
// repeat something from yesterday, which is not continuity, it is haunting.

export type VoiceDropReason = 'user' | 'agent' | 'error' | 'unknown';

export type VoiceDrop = {
  reason: VoiceDropReason;
  /** True when the agent was mid-sentence, so its last answer went unheard. */
  midSpeech: boolean;
  at: number;
};

/** How long a drop stays worth mentioning. Longer than this and she has moved on. */
const CARRY_FORWARD_MS = 5 * 60 * 1000;

let lastDrop: VoiceDrop | null = null;
let speaking = false;

/** The agent started or stopped talking. Drives `midSpeech` above. */
export function noteSpeaking(isSpeaking: boolean): void {
  speaking = isSpeaking;
}

export function noteDrop(reason: VoiceDropReason): void {
  lastDrop = { reason, midSpeech: speaking, at: Date.now() };
  speaking = false;
  // Deliberately a log line and not a toast. This is for us, and the next
  // session's own behaviour is what the person should notice.
  console.log(
    `VOICE SESSION ENDED: ${reason}${lastDrop.midSpeech ? ', while the agent was speaking' : ''}`
  );
}

/**
 * The drop worth carrying into the session starting now, if any.
 *
 * Only an UNEXPECTED one. A session she closed herself needs no explanation and
 * no apology - offering to repeat something she chose to walk away from would
 * be the app arguing with her.
 */
export function dropToCarry(): VoiceDrop | null {
  if (!lastDrop) return null;
  if (lastDrop.reason === 'user') return null;
  if (Date.now() - lastDrop.at > CARRY_FORWARD_MS) return null;
  return lastDrop;
}

/** Called once the new session has been told, so it is not told twice. */
export function clearDrop(): void {
  lastDrop = null;
}
