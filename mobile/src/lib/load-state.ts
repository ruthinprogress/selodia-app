// LOADING, READY, OR FAILED - AND THEY ARE THREE DIFFERENT THINGS.
//
// Ruth, 2 October 2026, after two days of screens that looked broken: "none of the
// build you say you've done is actually working... it's even hard to know where to
// start."
//
// WHAT I BUILT WRONG, FIVE TIMES IN ONE DAY. Every setup screen that reads her
// existing answers got this from me:
//
//   if (error) return;              // `loaded` never becomes true
//   if (!loaded) return null;       // the screen renders NOTHING
//   enabled: !saving && loaded      // Continue never enables
//
// I argued in the commit messages that this was "the safe failure", and against
// one risk it is: an unloaded activities screen cannot tell "she deselected
// everything" from "nothing arrived yet", and acting on that confusion deleted her
// week on 1 October. That reasoning was right.
//
// THE CONCLUSION WAS WRONG. Safe against losing a row is not the same as safe for
// her. A screen that renders nothing, with a dead button and no message, is the
// worst outcome available: she cannot proceed, cannot retry, and cannot tell
// whether the app is broken or she is holding it wrong. Two states were collapsed
// into one boolean - "not yet" and "it failed" - and the second one got the
// treatment designed for the first. "Not yet" lasts milliseconds. "It failed"
// lasts forever.
//
// SO THERE ARE THREE STATES. Loading disables the button, for the moment it takes.
// Failed says so, offers a retry, and LETS HER PAST - moving on without writing,
// which protects the row without trapping her. Ready behaves normally.
//
// NOTHING DESTRUCTIVE EVER RUNS ON A FAILED READ. That is the one property from
// the original design worth keeping, and it is kept: a screen only writes when it
// is `ready`, so a blank selection can never be mistaken for an answer.

export type LoadState = 'loading' | 'ready' | 'failed';

/** Shown when the read failed, in place of pretending the screen is empty. */
export const LOAD_FAILED_MESSAGE =
  'Your answers could not be loaded just now, so this screen is not showing them. Nothing here has changed. Try again, or carry on and come back to it.';

export const LOAD_RETRY_LABEL = 'Try again';

/** Whether this screen may write. Only ever true once her answers are in hand. */
export function mayWrite(state: LoadState): boolean {
  return state === 'ready';
}

/**
 * Whether the forward button should be pressable.
 *
 * TRUE WHEN THE READ FAILED, deliberately. She is not trapped by a problem she
 * cannot fix; the screen simply does not write on the way past, and says so.
 */
export function mayContinue(state: LoadState, saving: boolean): boolean {
  return !saving && state !== 'loading';
}
