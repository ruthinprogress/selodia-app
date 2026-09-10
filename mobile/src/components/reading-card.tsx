import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadNoteFor } from '@/lib/interpretation-notes';
import type { MeasurementRow } from '@/lib/overview-metrics';

// The reading card — build item 30, slice 4, for measurements.
//
// WHY THIS EXISTS, and it is a gap rather than a feature request. Item 29 has
// persisted a point-in-time interpretation note against every body-measurement
// row since 2026-08-31, and `loadNoteFor` was written to read them back. It had
// ZERO CALLERS until this component: the notes were being written and stored and
// never shown to anybody. The one discuss-card that existed is
// `food-breakdown-card.tsx`, and `persistNote` is only ever called with
// 'body_measurement' — so the writer and the only viewer did not overlap at all.
//
// WHAT MAKES THE NOTE WORTH SHOWING is precisely that it is NOT recomputed. It is
// what Selodía said about this reading on the day it was taken, kept as a diary
// record. `food-breakdown-card.tsx` says the same thing from the other side: it
// deliberately has no note section because "computing one live here would
// contradict exactly what item 29 exists to guarantee". This reads the stored
// row and never derives anything.
//
// SILENCE IS A REAL ANSWER. Item 29 stores a note only when there was something
// worth saying — a clean reading with no caveats produces none, by design — so a
// card with no note is the ordinary case and renders no empty section, no
// placeholder and no explanation. Principle 8, applied to a modal.
//
// The "Ask about this" button belongs to item 30's interactive half and is
// deliberately absent, exactly as it is on the food card: rendering it before the
// behaviour exists would be the dead control principle 8 forbids.

type Props = {
  reading: MeasurementRow | null;
  dateLabel: string;
  onClose: () => void;
};

const fmt = (v: number | null | undefined, unit: string): string | null =>
  v == null ? null : `${Math.round(v * 10) / 10}${unit}`;

export function ReadingCard({ reading, dateLabel, onClose }: Props) {
  const theme = useTheme();
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!reading?.id) {
        if (!cancelled) setLoading(false);
        return;
      }
      const stored = await loadNoteFor('body_measurement', reading.id);
      if (!cancelled) {
        setNote(stored);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reading?.id]);

  const metrics = [
    ['Weight', fmt(reading?.weight_kg, ' kg')],
    ['Body fat', fmt(reading?.body_fat_pct, '%')],
    ['Muscle', fmt(reading?.muscle_kg, ' kg')],
  ].filter(([, v]) => v !== null) as [string, string][];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} accessibilityViewIsModal>
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.scrim }]}
        onPress={onClose}
        accessibilityLabel="Close"
      />
      <View style={styles.centre} pointerEvents="box-none">
        <ThemedView style={styles.card}>
          <ScrollView contentContainerStyle={styles.body}>
            <ThemedText type="smallBold">{dateLabel}</ThemedText>

            {metrics.map(([label, value]) => (
              <ThemedView key={label} type="backgroundElement" style={styles.metric}>
                <ThemedText type="small" themeColor="textSecondary">
                  {label}
                </ThemedText>
                <ThemedText type="small">{value}</ThemedText>
              </ThemedView>
            ))}

            {/* The note, when there is one. Labelled by its DATE rather than
                "interpretation", because what makes it worth reading is that it
                is what was said at the time, not that a layer produced it. */}
            {!loading && note ? (
              <ThemedView type="backgroundElement" style={styles.note}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.noteLabel}>
                  What I said at the time
                </ThemedText>
                <ThemedText type="small">{note}</ThemedText>
              </ThemedView>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.close}>
                Close
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Geometry only; the colour comes from theme.scrim at render, same as the
  // food breakdown card.
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  card: { width: '100%', maxWidth: MaxContentWidth, borderRadius: Spacing.two, overflow: 'hidden' },
  body: { padding: Spacing.three, gap: Spacing.two },
  metric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.one,
  },
  note: { padding: Spacing.two, borderRadius: Spacing.one, gap: Spacing.half },
  noteLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  actions: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, alignItems: 'flex-end' },
  close: { paddingVertical: Spacing.one },
  pressed: { opacity: 0.6 },
});
