import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// The one time voice is explained, before it is ever used.
//
// A MODAL, NOT THE INLINE HINT PATTERN. Consent is a deliberate act, and the
// quiet dismissible line used for tab tooltips is exactly wrong here: that
// pattern is designed to be ignorable. This one has to be read and answered.
//
// WHAT IT SAYS AND WHY IT SAYS IT. The OS dialog cannot carry any of this.
// "Selodía would like to access the microphone" says nothing about audio
// leaving the phone, so agreeing to it is not informed consent to a third party
// processing your voice. Hence: who processes it, that the audio is not kept,
// and - the part it would be easy to leave out - that what you say IS saved,
// into the chat thread, like any typed message. An earlier draft of this copy
// said "nothing is stored beyond the conversation", which was not true: the
// transcript is written to the thread by design (Part Eighteen, Thread
// behaviour). A consent notice that overstates the privacy is worse than none.
//
// "NOT NOW" IS A REAL ANSWER, not a delay. It dismisses, stamps nothing, and
// leaves voice off. Part Eighteen's onboarding rule - "no pressure toward
// voice, a genuine equal choice" - applies here more than anywhere, because
// this is the moment the choice is actually made.

export function VoiceConsentSheet({
  visible,
  onAccept,
  onDecline,
  busy = false,
}: {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
  busy?: boolean;
}) {
  const theme = useTheme();
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDecline} accessibilityViewIsModal>
      {/* Tapping the scrim is "Not now", not "yes". The safe default for a
          consent sheet is always the one that grants nothing. */}
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.scrim }]}
        onPress={onDecline}
        accessibilityLabel="Close"
      />
      <View style={styles.bottom} pointerEvents="box-none">
        <ThemedView style={styles.sheet}>
          <ThemedText type="subtitle">Voice logging</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            Your voice is processed by ElevenLabs so you can log hands-free. The audio isn&apos;t
            kept. What you say is saved to your chat thread like any other message.
          </ThemedText>

          <Pressable
            onPress={onAccept}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Turn on voice"
            style={({ pressed }) => pressed && styles.pressed}
          >
            <View style={[styles.primary, { backgroundColor: theme.accentDeep }, busy && styles.busy]}>
              {/* accentDeep, not accent, and the difference is measured rather
                  than felt: cream on #C97458 is 3.37:1, under AA for body text;
                  on accentDeep #874C3A it is 6.61:1. accentDeep exists for
                  exactly this - terracotta deep enough to carry text - and this
                  button is the one place the accent is a FILL behind words. */}
              <ThemedText type="smallBold" style={styles.primaryLabel}>
                {busy ? 'One moment…' : 'Turn on voice'}
              </ThemedText>
            </View>
          </Pressable>

          <Pressable
            onPress={onDecline}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Not now"
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedText type="small" themeColor="textSecondary" style={styles.secondary}>
              Not now
            </ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  bottom: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    padding: Spacing.three,
    gap: Spacing.three,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
  },
  body: { lineHeight: 20 },
  primary: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  primaryLabel: { color: '#FFFDF7' },
  busy: { opacity: 0.6 },
  secondary: { textAlign: 'center', paddingVertical: Spacing.two },
  pressed: { opacity: 0.6 },
});
