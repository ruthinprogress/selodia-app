import { useCallback, useEffect, useRef } from 'react';
import { Dimensions, Keyboard, type ScrollView } from 'react-native';

import { shouldAnimate } from '@/lib/chat-scroll-rules';

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
// rendering under a turn once its rows load. Content size covers all of them
// with one signal.
//
// THEN IT ARRIVED SOMEWHERE VIOLENT (Ruth, 21 September 2026):
//
//   "when you open the app, the chat scrolls violently through all the past
//   chat, landing in the present. It doesn't feel calm at all. Can we change it
//   so it just opens where the chat is actually up to, not mad scrolling to the
//   present?"
//
// The first version guarded exactly one frame - `settled` flipped true after the
// first size change - and a thread does not arrive in one frame. It arrives in
// a dozen: the history query, then the images, then a food table filling in
// under a turn from three weeks ago. Every one of those after the first was an
// ANIMATED scroll through her whole conversation, one after another. The guard
// was right about the problem and wrong about its length.
//
// SO THE OPENING IS A PERIOD, NOT AN EVENT. While the thread is still assembling
// itself the view is simply PUT at the bottom, with no travel at all; only once
// it has stopped arriving does a new message get the animation, which is the one
// place animation earns its keep - it says something new came in.
//
// AND A BIG JUMP IS NEVER ANIMATED, however late it lands. A slow history query
// can finish after any timer, and scrolling a screenful or more is the violent
// motion itself regardless of what the clock says. A new message is small; the
// past arriving is not.

export function useChatScroll() {
  const ref = useRef<ScrollView | null>(null);
  const openedAt = useRef(Date.now());
  const lastHeight = useRef(0);

  const onContentSizeChange = useCallback((_w: number, h: number) => {
    const grew = h - lastHeight.current;
    lastHeight.current = h;

    ref.current?.scrollToEnd({
      animated: shouldAnimate(Date.now() - openedAt.current, grew, Dimensions.get('window').height),
    });
  }, []);

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

  return { ref, onContentSizeChange };
}
