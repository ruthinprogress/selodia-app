import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { loadLatestInterpretation } from '@/lib/log-acknowledgment-facts';

// What the latest reading actually means (build item 38, slice 2) - the Body
// Measurement Interpretation Layer, Part Nine, finally reaching a screen.
//
// SCOPE. This is a live statement about the CURRENT reading, which is why it
// sits above the table rather than on a row, and why it is computed on read.
// The per-entry PERSISTED note described under Persisted Interpretation Notes
// is a different artefact: a point-in-time diary entry attached to one
// body_measurements row, shown by that row's discuss-card. Its store and write
// exist as of 2026-08-31 (item 29, interpretation-notes.ts) - and this very
// component is one of the three surfaces that triggers the write, since it calls
// loadLatestInterpretation. What is still missing is only the VIEWER, the
// discuss-card (item 30 slice 4). So the same sentence rendered here is also the
// one recorded against that reading forever, composed once by the same pure
// function.
//
// It renders nothing at all when there is nothing worth saying. interpretLatest-
// Reading returns null for a clean drop with no caveats and for a sparse history
// with no noise flags, and both of those are correct silences: a reassurance
// nobody needed would be noise, and a direction claimed from two readings would
// be a lie (Part Nine's sparse-data rule).

// IT READ ONCE AND NEVER AGAIN (Ruth, 23 September 2026, from a screenshot of
// two contradictory readings of the same weigh-in):
//
//   card:   "Weight's up 0.5 kg since yesterday ... cycle day 3"
//   bubble: "Weight's flat since your reading 3 days ago ... yesterday was on
//            the salty side"
//
// Both about one reading, and the numbers say the second is the answer for the
// PREVIOUS weigh-in: 55.55 against 55.6 three days earlier genuinely was flat.
//
// The Log tab stays mounted, so an empty dependency array meant this loaded
// once and held that sentence until the app restarted, while the view around it
// re-read itself happily through useFocusReload. Exactly the Health Flower
// fault of 17 September, where the Overview refetched its cards and never asked
// the flower's hook to read again. The parent refetching is not the child
// refetching, and a stale statement about someone's body is worse than none.
//
// `hidden` is the second half. bodyAckFacts calls loadLatestInterpretation too,
// so the acknowledgment the quick-log bar shows already CONTAINS this sentence.
// Rendering it again a few hundred pixels below was duplication by design even
// when both were fresh.
export function ReadingInterpretationNote({ hidden = false }: { hidden?: boolean }) {
  const [note, setNote] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useFocusReload(setReloadKey);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const message = await loadLatestInterpretation();
      if (!cancelled) setNote(message);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (!note || hidden) return null;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="small">{note}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
});
