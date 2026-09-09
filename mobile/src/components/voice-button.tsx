import { Pressable, StyleSheet } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useConversation } from '@elevenlabs/react-native';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// The mic in the composer. Tap to start, tap to close. That is the whole model.
//
// WHAT THIS REPLACES, and why, because the first version was built to the spec
// and the spec turned out to be wrong about how it feels in a hand.
//
// Part Eighteen specified long-press to start, tap to pause, long-press again
// to end - the reasoning being that one icon could carry both the quick voice
// note and the full conversation if the quick thing got the quick gesture. On a
// real phone on 2026-09-09 that failed in three separate ways:
//
//   - Opening took THREE TO SIX attempts. A tap while disconnected did nothing
//     at all by design, so every tap before the successful hold read as a dead
//     button rather than as the wrong gesture.
//   - Closing was reached for as a tap, twice, unprompted. Tap meant pause, so
//     the session stayed open and Selodia carried on.
//   - Paused and off were indistinguishable: dimmed sage against grey, on a
//     36pt icon, with no other signal anywhere on screen.
//
// So: no long-press, and no pause. Pause was solving a problem nobody had -
// the session either matters or it is over - and it was the state that made
// the other two illegible. The session's own state now lives on a full screen
// (voice-session-screen.tsx) rather than in this icon, which leaves the icon
// one job: start it, or end it.
//
// The quick voice note (build item 34) will need its own answer now that it
// cannot have the tap. That is a real consequence, recorded rather than
// glossed: a second control, or a gesture on the composer, decided when that
// feature is actually built rather than reserved for it now.

export type VoiceButtonProps = {
  /** Runs the consent check, fetches a token and opens the session. */
  onRequestStart: () => void;
  disabled?: boolean;
};

export function VoiceButton({ onRequestStart, disabled = false }: VoiceButtonProps) {
  const theme = useTheme();
  const { status, endSession } = useConversation();

  // Anything that is not plainly disconnected counts as live, so a tap during
  // the connecting moment closes rather than opening a second session on top
  // of the first.
  const live = status !== 'disconnected';

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        if (live) endSession();
        else onRequestStart();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={live ? 'Close voice session' : 'Start a voice conversation'}
      accessibilityState={{ disabled, selected: live }}
      hitSlop={Spacing.three}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <ThemedView type="backgroundElement" style={[styles.button, disabled && styles.disabled]}>
        <Ionicons
          name="mic"
          size={18}
          // Sage while a session is live, so the composer still says so if the
          // person navigates away from the voice screen. Grey otherwise.
          color={live ? theme.sage : theme.textSecondary}
        />
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
