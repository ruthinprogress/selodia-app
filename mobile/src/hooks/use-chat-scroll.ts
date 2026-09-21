import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, type ScrollView } from 'react-native';

import { QUIET_MS, REVEAL_CEILING_MS, shouldAnimate } from '@/lib/chat-scroll-rules';

// Keeping the newest message in view.
//
// Found live 2026-08-27: the thread never moved. Opening Chat landed you at the
// TOP of the entire conversation, and sending a message left the reply below the
// fold - you had to scroll down to read what you had just been told. There was
// no ref, no scrollToEnd, nothing: it had simply never been implemented.
//
// Driven by onContentSizeChange rather than by a messages-length effect, because
// the thread grows for reasons a message count does not capture: history
// hydrating on mount, a signed image URL arriving, the food breakdown table
// rendering under a turn once its rows load.
//
// THEN IT ARRIVED SOMEWHERE VIOLENT (Ruth, 21 September 2026):
//
//   "when you open the app, the chat scrolls violently through all the past
//   chat, landing in the present. It doesn't feel calm at all. Can we change it
//   so it just opens where the chat is actually up to, not mad scrolling to the
//   present?"
//
// THE FIRST ATTEMPT TURNED THE ANIMATION OFF AND WAS NOT ENOUGH. Her note back
// the same evening: "crazy scroll entry still happening." Turning off animation
// only governs how the view TRAVELS; it does nothing about the fact that the
// thread is assembled on screen in front of her. A ScrollView holding a long
// history lays out from the top, and every chunk that arrives - the history
// query, then the images, then a food table filling in under a turn from three
// weeks ago - moves the content under the viewport. Instant jumps through an
// assembling thread look exactly like scrolling through it, because they are.
//
// SO THE THREAD IS NOT SHOWN UNTIL IT IS PLACED. It lays out as normal,
// invisibly, and is revealed once it has stopped arriving - by which time the
// view is already at the newest message. There is no travel to watch because
// nothing is visible until there is nothing left to travel through. That is
// what "just opens where the chat is actually up to" actually requires.
//
// A HARD CEILING ON THE WAIT, because a chat that never appears would be far
// worse than one that arrives untidily. It is deliberately generous: while the
// history is still loading there is nothing to look at either way, so hiding
// costs nothing, and the only thing the ceiling protects against is a query
// that never returns.

// `pending` is whatever the screen is still waiting for - the history query,
// in Chat's case. WITHOUT IT THE REVEAL FIRES TOO EARLY (found 21 September
// 2026, after Ruth reported the scroll a second time): the quiet countdown
// started at mount, the history read took longer than it, and the thread was
// revealed EMPTY - so the whole history then landed in full view, which is
// precisely the thing being hidden. Nothing settles while something is still on
// its way.
export function useChatScroll(pending: boolean = false) {
  const ref = useRef<ScrollView | null>(null);
  const openedAt = useRef(Date.now());
  const lastHeight = useRef(0);

  // `settled` drives what the screen shows; the ref is what the callback reads,
  // so the handler never closes over a stale value.
  const [settled, setSettled] = useState(false);
  const isSettled = useRef(false);
  const quiet = useRef<ReturnType<typeof setTimeout> | null>(null);

  const done = useCallback(() => {
    isSettled.current = true;
    setSettled(true);
  }, []);

  // Each arrival pushes the reveal back a little; a pause means it has finished.
  const waitForQuiet = useCallback(() => {
    if (isSettled.current) return;
    if (quiet.current) clearTimeout(quiet.current);
    quiet.current = setTimeout(done, QUIET_MS);
  }, [done]);

  useEffect(() => {
    // The ceiling runs from mount whatever happens, so a query that never
    // returns cannot leave the thread invisible for ever.
    const ceiling = setTimeout(done, REVEAL_CEILING_MS);
    return () => clearTimeout(ceiling);
  }, [done]);

  useEffect(() => {
    // While something is still loading, keep pushing the reveal back. Once it
    // is done, the ordinary quiet period decides - and an empty thread, which
    // never fires a size change at all, is settled by this same countdown.
    if (pending) {
      if (quiet.current) clearTimeout(quiet.current);
      return;
    }
    waitForQuiet();
    return () => {
      if (quiet.current) clearTimeout(quiet.current);
    };
  }, [pending, waitForQuiet]);

  const onContentSizeChange = useCallback(
    (_w: number, h: number) => {
      const grew = h - lastHeight.current;
      lastHeight.current = h;

      ref.current?.scrollToEnd({
        animated: shouldAnimate(Date.now() - openedAt.current, grew, Dimensions.get('window').height),
      });

      waitForQuiet();
    },
    [waitForQuiet]
  );

  // The keyboard opening is the one case onContentSizeChange cannot catch. The
  // layout gets SHORTER (that is the whole point of the keyboard-avoiding
  // padding) while the content stays exactly the same size, so nothing fires -
  // and the newest message slides up under the input, which is the same
  // can't-see-it problem one layer along. Handled here rather than per screen so
  // all eight conversation screens get it from one place.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      ref.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  return { ref, onContentSizeChange, settled };
}
