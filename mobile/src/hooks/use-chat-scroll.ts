import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Dimensions, Keyboard, type ScrollView } from 'react-native';

import { QUIET_MS, REVEAL_CEILING_MS, shouldAnimate } from '@/lib/chat-scroll-rules';

// Keeping the newest message in view.
//
// Found live 2026-08-27: the thread never moved. Opening Chat landed you at the
// TOP of the entire conversation, and sending a message left the reply below the
// fold. There was no ref, no scrollToEnd, nothing.
//
// Driven by onContentSizeChange rather than by a messages-length effect, because
// the thread grows for reasons a message count does not capture: history
// hydrating, a signed image URL arriving, a food table filling in under a turn.
//
// THEN IT ARRIVED SOMEWHERE VIOLENT (Ruth, 21 September 2026):
//
//   "when you open the app, the chat scrolls violently through all the past
//   chat, landing in the present. It doesn't feel calm at all."
//
// AND THEN IT TOOK FOUR GOES, which is worth writing down properly because the
// first three were the same mistake wearing different clothes.
//
//   1. Turned the animation off during an opening window. Still happened. That
//      only governs how the view TRAVELS; it says nothing about the thread
//      being assembled on screen in front of her.
//   2. Hid the thread until it stopped growing. Still happened.
//   3. Held the reveal until the history query finished. Still happened.
//
// EVERY ONE OF THOSE RAN AT MOUNT, AND OPENING THE APP IS NOT A MOUNT. Chat is
// the first tab. It mounts once and stays mounted for the life of the process,
// so reopening the app RESUMES it: no mount, none of that code runs, `settled`
// is still true from hours ago, and the thread reloads in full view. Three
// fixes could not work, for a reason that had nothing to do with any of them.
//
// This is the SECOND time this exact trap has cost a day on this app. The first
// was a handoff that never ran because it sat in a lazy useState initialiser on
// a screen that was already mounted. The lesson both times: on this screen,
// "when it opens" means FOCUS AND RESUME, and never mount.
//
// So the opening state is reset by useFocusEffect and by AppState going active,
// and mount is one more way in rather than the only one.

export function useChatScroll(pending: boolean = false) {
  const ref = useRef<ScrollView | null>(null);
  // Zero until the first opening, rather than Date.now() here: reading the clock
  // during render is impure, and reopen() sets it before anything can read it.
  const openedAt = useRef(0);
  const lastHeight = useRef(0);

  // `settled` drives what the screen shows; the ref is what the callbacks read,
  // so a handler never closes over a stale value.
  const [settled, setSettled] = useState(false);
  const isSettled = useRef(false);
  const quiet = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ceiling = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /** Treat this as a fresh opening: hide, re-measure, arrive at the bottom. */
  const reopen = useCallback(() => {
    openedAt.current = Date.now();
    lastHeight.current = 0;
    isSettled.current = false;
    setSettled(false);
    if (ceiling.current) clearTimeout(ceiling.current);
    // A chat that never appears would be far worse than one that arrives
    // untidily, so it is revealed regardless after this.
    ceiling.current = setTimeout(done, REVEAL_CEILING_MS);
    waitForQuiet();
  }, [done, waitForQuiet]);

  // COMING BACK TO THE SCREEN COUNTS AS OPENING IT. This is the line the first
  // three attempts were missing.
  useFocusEffect(
    useCallback(() => {
      reopen();
    }, [reopen])
  );

  // AND SO DOES THE APP WAKING UP, which changes no focus at all: Chat can be
  // the focused screen for days while the phone is in a pocket.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') reopen();
    });
    return () => sub.remove();
  }, [reopen]);

  useEffect(
    () => () => {
      if (quiet.current) clearTimeout(quiet.current);
      if (ceiling.current) clearTimeout(ceiling.current);
    },
    []
  );

  // Nothing settles while something is still on its way - the history query, in
  // Chat's case. Without this the reveal fires on an EMPTY thread and the whole
  // history then lands in full view, which is the thing being hidden.
  useEffect(() => {
    if (pending) {
      if (quiet.current) clearTimeout(quiet.current);
      return;
    }
    waitForQuiet();
  }, [pending, waitForQuiet]);

  const onContentSizeChange = useCallback(
    (_w: number, h: number) => {
      const grew = h - lastHeight.current;
      lastHeight.current = h;

      // A zero here means the opening has not been stamped yet, which is itself
      // an opening - so it reads as "no time has passed" and does not animate.
      const sinceOpen = openedAt.current === 0 ? 0 : Date.now() - openedAt.current;
      ref.current?.scrollToEnd({
        animated: shouldAnimate(sinceOpen, grew, Dimensions.get('window').height),
      });

      waitForQuiet();
    },
    [waitForQuiet]
  );

  // The keyboard opening is the one case onContentSizeChange cannot catch. The
  // layout gets SHORTER while the content stays the same size, so nothing fires,
  // and the newest message slides up under the input.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      ref.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  return { ref, onContentSizeChange, settled };
}
