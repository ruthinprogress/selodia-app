// WHEN THE THREAD SHOULD TRAVEL, AND WHEN IT SHOULD SIMPLY ARRIVE.
//
// Ruth, 21 September 2026:
//
//   "when you open the app, the chat scrolls violently through all the past
//   chat, landing in the present. It doesn't feel calm at all. Can we change it
//   so it just opens where the chat is actually up to, not mad scrolling to the
//   present?"
//
// Split out of use-chat-scroll.ts so it can be probed. The hook imports React
// Native and cannot run outside the app; this is the rule itself, which is the
// part that was wrong.
//
// THE OPENING IS A PERIOD, NOT AN EVENT. The first version guarded exactly one
// frame, and a thread does not arrive in one frame - it arrives in a dozen: the
// history query, then the images, then a food table filling in under a turn
// from three weeks ago. Every one of those after the first was an animated
// scroll through her whole conversation, one after another.

// Long enough for a history query and its images on a slow morning, short
// enough that a real reply a second later still animates. It doubles as the
// hard ceiling on hiding the thread: past this it is revealed whether it has
// finished arriving or not, because a blank screen is its own kind of wrong.
export const OPENING_MS = 2500;

// How long the thread has to stop growing before it counts as arrived. Short,
// because this is the delay somebody actually waits on an ordinary open.
export const QUIET_MS = 220;

// The longest the thread may stay hidden, counted from mount. Separate from
// OPENING_MS, and longer, because the two answer different questions: that one
// asks "is this still the opening, so do not animate", this one asks "has
// something gone wrong, show it anyway".
//
// Generous on purpose. While the history is still loading there is nothing to
// look at either way, so hiding costs nothing - the only thing this protects
// against is a query that never returns leaving a permanently blank chat.
export const REVEAL_CEILING_MS = 5000;

/**
 * Whether this growth deserves to be travelled through, or simply arrived at.
 *
 * Animation earns its keep in exactly one place: saying something new came in.
 * Everything else - the past assembling itself - is a position to be in, not a
 * journey to watch.
 */
export function shouldAnimate(sinceOpen: number, grew: number, screenHeight: number): boolean {
  if (sinceOpen < OPENING_MS) return false;
  // A BIG JUMP IS NEVER ANIMATED, HOWEVER LATE IT LANDS. A slow history query
  // can finish after any timer, and scrolling a screenful is the violent motion
  // itself regardless of what the clock says. Half a screen: less than this is a
  // message, more is the past arriving.
  if (grew > screenHeight / 2) return false;
  return true;
}
