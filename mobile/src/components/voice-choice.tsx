import { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { hasVoiceConsent, withdrawVoiceConsent } from '@/lib/voice-consent';

// TURNING VOICE OFF, WHICH WAS NOT POSSIBLE UNTIL NOW.
//
// Ruth, 1 October 2026: "Give me the exact tap path from the home screen to turn
// voice off and on, and its label."
//
// There was no path. `recordVoiceConsent` set the stamp and nothing anywhere
// cleared it: once voice was on it was on for good, short of deleting the
// account. The question had no answer, and looking for one is what found it.
//
// IT IS NOT ONLY A CONVENIENCE. Consent has to be as easy to withdraw as it was
// to give. The sheet that grants it is one tap from the chat box; withdrawing it
// required somebody with database access. That is not a defensible position for
// a permission covering a microphone and a third-party processor, and it is the
// kind of gap that is invisible until somebody asks the obvious question.
//
// WITHDRAWING DOES NOT DELETE WHAT WAS SAID, and the copy says so rather than
// letting her assume. The transcripts are in her chat thread like any other
// message, and ElevenLabs delete their copy after 30 days whatever this
// toggle says. Turning it off stops new audio being sent; it is not an erasure,
// and offering it as one would be the same shape of untrue comfort as "the audio
// isn't kept".
//
// TURNING IT BACK ON IS THE SHEET, not this row. The sheet is where the
// explanation lives, and a silent re-grant from a settings row would be consent
// without the information attached to it.
export function VoiceChoice() {
  const [on, setOn] = useState<boolean | null>(null);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void hasVoiceConsent().then((v) => {
        if (!cancelled) setOn(v);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  // Nothing is drawn until the answer arrives: a row that says "off" for a
  // moment and then flips reads as a setting that changed itself.
  if (on === null) return null;

  async function turnOff() {
    if (working) return;
    setWorking(true);
    setFailed(false);
    const ok = await withdrawVoiceConsent();
    setWorking(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    setOn(false);
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Voice</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {on
          ? 'Voice logging is on. Turning it off stops any new audio being sent to ElevenLabs. It does not remove what has already been said: those transcripts stay in the chat thread, and ElevenLabs delete their copy 30 days after it was said.'
          : 'Voice logging is off. To turn it back on, tap the microphone in the chat box and Selodía will explain what happens to your voice before anything is sent.'}
      </ThemedText>

      {on && (
        <Pressable
          onPress={() => void turnOff()}
          disabled={working}
          accessibilityRole="button"
          accessibilityLabel="Turn off voice logging"
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="smallBold" themeColor="accentDeep">
            {working ? 'Turning off…' : 'Turn off voice'}
          </ThemedText>
        </Pressable>
      )}

      {failed && (
        <ThemedText type="small" themeColor="danger">
          That didn&apos;t save, so voice is still on. Worth trying again.
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: CardRadius,
    gap: Spacing.two,
  },
  pressed: { opacity: 0.6 },
});
