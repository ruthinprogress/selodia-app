import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, type ScrollView } from 'react-native';

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
export function useChatScroll() {
  const ref = useRef<ScrollView | null>(null);
  // The first size change is the thread arriving, not a new message. Animating
  // that would scroll the whole history past the person on every app open.
  const settled = useRef(false);

  const onContentSizeChange = useCallback(() => {
    ref.current?.scrollToEnd({ animated: settled.current });
    settled.current = true;
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
