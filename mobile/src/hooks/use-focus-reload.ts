import { useFocusEffect } from 'expo-router';
import { useCallback, type Dispatch, type SetStateAction } from 'react';

// RE-READ WHEN THE SCREEN COMES INTO VIEW, AND AGAIN SHORTLY AFTER (2026-09-19).
//
// The Log tab stays mounted, so its views loaded once and never again: an entry
// logged by voice or in chat did not appear until the app restarted. A re-read
// on focus fixed that for entries already saved - and not for the one that
// matters most. A spoken meal is parsed AFTER the reply is sent, so its row
// lands a few seconds after the call ends, and somebody who goes straight to
// the log to check arrives before it. Ruth did exactly that twice and saw
// nothing.
//
// So: once on arrival, and twice more while the screen stays in view, timed to
// cover a parse that is still finishing. Nothing runs once they leave. A
// realtime subscription would be the complete answer; it needs the database's
// realtime publication switched on, and this closes the gap without it.
const FOLLOW_UPS_MS = [4_000, 10_000];

export function useFocusReload(setReloadKey: Dispatch<SetStateAction<number>>) {
  useFocusEffect(
    useCallback(() => {
      setReloadKey((k) => k + 1);
      const timers = FOLLOW_UPS_MS.map((ms) => setTimeout(() => setReloadKey((k) => k + 1), ms));
      return () => timers.forEach(clearTimeout);
    }, [setReloadKey])
  );
}
