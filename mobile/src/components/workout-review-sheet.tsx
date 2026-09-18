import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VoiceNoteButton } from '@/components/voice-note-button';
import { ButtonRadius, CardRadius, PageInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// "What happened today?" - the review before a session is written (Ruth's
// revised brief, 2026-09-18).
//
// THE SHIFT THIS SHEET CARRIES: "the goal is not to measure compliance with a
// predefined routine. The goal is to accurately record what actually happened."
// So it states facts and asks for the rest in her own voice. It never scores the
// session, never says a percentage, and never treats a full routine as better
// than three movements and a sore knee.
//
// WHAT IT SAYS, AND WHAT IT REFUSES TO SAY. "Completed 5 of 7" is a count of
// what happened. "71%" is the same fact turned into a mark out of ten, and this
// sheet will not carry one.

export type ReviewLine = { label: string; value: string };

export function WorkoutReviewSheet({
  title,
  lines,
  note,
  onNoteText,
  onNotice,
  notice,
  saving,
  onSave,
  onClose,
}: {
  title: string;
  lines: ReviewLine[];
  note: string;
  onNoteText: (text: string) => void;
  onNotice: (message: string) => void;
  notice: string | null;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();

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
            <ThemedText type="sectionTitle">What happened today?</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {title}
            </ThemedText>

            <View style={styles.lines}>
              {lines.map((l) => (
                <View key={l.label} style={styles.line}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.lineLabel}>
                    {l.label}
                  </ThemedText>
                  <ThemedText type="small" style={styles.lineValue}>
                    {l.value}
                  </ThemedText>
                </View>
              ))}
            </View>

            {/* THE NOTE IS THE POINT OF THIS SHEET, and it is spoken because
                nobody types "stopped because my knee hurt" standing in a gym.
                Months from now these are what let the Almanac notice that the
                knee has come up three times, which no checkbox can ever say. */}
            <ThemedView type="backgroundElement" style={styles.noteCard}>
              <View style={styles.noteRow}>
                <VoiceNoteButton onText={onNoteText} onNotice={onNotice} disabled={saving} />
                <ThemedText type="small" themeColor={note.trim() ? 'text' : 'textSecondary'} style={styles.noteText}>
                  {note.trim() || 'Say what was different, if anything'}
                </ThemedText>
              </View>
              {notice && (
                <ThemedText type="small" themeColor="textSecondary">
                  {notice}
                </ThemedText>
              )}
            </ThemedView>

            <View style={styles.actions}>
              <Pressable
                onPress={onSave}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Save this to Activity"
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedView type="accentDeep" style={styles.primary}>
                  <ThemedText type="smallBold" themeColor="background">
                    {saving ? 'Saving…' : 'Save'}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={onClose}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Back to the routine"
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedText type="small" themeColor="textSecondary" style={styles.quiet}>
                  Back
                </ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  centre: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four },
  card: { borderRadius: CardRadius, maxHeight: '80%' },
  body: { padding: PageInset.horizontal, gap: Spacing.three },
  lines: { gap: Spacing.two, paddingTop: Spacing.two },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  lineLabel: { width: 110 },
  lineValue: { flex: 1 },
  noteCard: { borderRadius: CardRadius, padding: Spacing.three, gap: Spacing.two },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  noteText: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.two },
  primary: { borderRadius: ButtonRadius, paddingVertical: Spacing.two, paddingHorizontal: Spacing.five },
  quiet: { paddingVertical: Spacing.two },
  pressed: { opacity: 0.7 },
});
