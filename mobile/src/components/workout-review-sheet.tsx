import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

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
//
// TWO FIELDS, NOT ONE (Ruth, 2026-09-18, on the first build): "sometimes I do
// some of a workout and just some other stuff that's not in it at all. So not
// necessarily an addition to a listed movement, not a change." She is right that
// those are different facts. What was different about the routine belongs
// against the routine; box jumps and ballet hip pulses belong to the session but
// to no movement in it, and folding them into "what was different" would file
// real work as an amendment to something else.
//
// AND BOTH CAN BE TYPED (same note): the first build offered voice only, on the
// reasoning that nobody types in a gym. True, and not a reason to make typing
// impossible - a quiet room, a misheard word, a name the transcription mangles,
// or simply preferring to type. The microphone stays where it was; the field it
// fills is now a field.

export type ReviewLine = { label: string; value: string };

export function WorkoutReviewSheet({
  title,
  lines,
  note,
  onNote,
  extras,
  onExtras,
  onNotice,
  notice,
  saving,
  onSave,
  onClose,
}: {
  title: string;
  lines: ReviewLine[];
  /** What was different about the routine itself. */
  note: string;
  onNote: (text: string) => void;
  /** Anything else done today that the routine never mentioned. */
  extras: string;
  onExtras: (text: string) => void;
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
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
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

            {/* THE NOTE IS THE POINT OF THIS SHEET, spoken or typed, because
                months from now these are what let the Almanac notice that the
                knee has come up three times, which no checkbox can ever say. */}
            <NoteField
              label="Anything different?"
              placeholder="Lighter on the squats, knee was sore"
              value={note}
              onChange={onNote}
              onNotice={onNotice}
              disabled={saving}
            />

            <NoteField
              label="Anything else you did?"
              placeholder="Box jumps 3×10, walked home"
              value={extras}
              onChange={onExtras}
              onNotice={onNotice}
              disabled={saving}
            />

            {notice && (
              <ThemedText type="small" themeColor="textSecondary">
                {notice}
              </ThemedText>
            )}

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

// One thing to say, in either way of saying it. The microphone appends rather
// than replaces, so speaking twice adds a second sentence instead of wiping the
// first - and typing after speaking works on what was heard.
function NoteField({
  label,
  placeholder,
  value,
  onChange,
  onNotice,
  disabled,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (text: string) => void;
  onNotice: (message: string) => void;
  disabled: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedView type="backgroundElement" style={styles.fieldCard}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          editable={!disabled}
          multiline
          // Grows with what is written rather than scrolling its own text out of
          // sight - the same fault the chat composer had until this morning.
          textAlignVertical="top"
          style={[styles.input, { color: theme.text }]}
          accessibilityLabel={label}
        />
        <View style={styles.mic}>
          <VoiceNoteButton
            onText={(text) => onChange(value.trim() ? `${value.trim()} ${text}` : text)}
            onNotice={onNotice}
            disabled={disabled}
          />
        </View>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  centre: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four },
  card: { borderRadius: CardRadius, maxHeight: '86%' },
  body: { padding: PageInset.horizontal, gap: Spacing.three },
  lines: { gap: Spacing.two, paddingTop: Spacing.two },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  lineLabel: { width: 110 },
  lineValue: { flex: 1 },
  field: { gap: Spacing.one },
  fieldCard: {
    borderRadius: CardRadius,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  input: {
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    fontSize: 14,
    lineHeight: 22,
    minHeight: 44,
    maxHeight: 140,
  },
  // Under the field rather than beside it: a microphone in the margin squeezes
  // the writing space on a phone, and this way the field keeps the full width.
  mic: { alignSelf: 'flex-start', paddingLeft: Spacing.one },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.two },
  primary: { borderRadius: ButtonRadius, paddingVertical: Spacing.two, paddingHorizontal: Spacing.five },
  quiet: { paddingVertical: Spacing.two },
  pressed: { opacity: 0.7 },
});
