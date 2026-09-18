import Ionicons from '@expo/vector-icons/Ionicons';
import {
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { VoiceConsentSheet } from '@/components/voice-consent-sheet';
import { ButtonRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authedUpload } from '@/lib/api';
import { logClientError } from '@/lib/client-error-log';
import {
  MIC_BLOCKED_MESSAGE,
  MIC_DENIED_MESSAGE,
  hasVoiceConsent,
  recordVoiceConsent,
  requestMicPermission,
} from '@/lib/voice-consent';

// THE MICROPHONE: A VOICE NOTE, NOT A CONVERSATION.
//
// Ruth's design, 16 September, restated 17 September after it went missing:
// "Microphone icon for voice note ... then wave bars icon for voice." Two
// controls, two faces. The sound bars open a live conversation with Selodía;
// this records what somebody wants to say and puts the words in the message box.
//
// It exists because the keyboard's own dictation key vanished inside Selodía,
// and that key was how voice notes were being logged. This does the same job
// without depending on whichever keyboard the phone has.
//
// TAP TO START, TAP TO STOP. Not press-and-hold: Ruth ruled long-press "too
// obscure" on 16 September, and the voice session's own history (voice-button.tsx)
// is the evidence that a hold reads as a dead button.
//
// THE WORDS GO INTO THE BOX, NOT STRAIGHT INTO THE THREAD. Transcription gets
// food names wrong often enough ("Weetabix", "bitesize") that sending unseen
// would log the wrong thing. Dictation always let her read it first; so does this.
//
// SAME CONSENT AS VOICE. The recording is processed by ElevenLabs, which is
// exactly what the voice consent sheet asks about, so it is the same sheet and
// the same stamp, shown once ever.

// A note, not a monologue, and a hard ceiling that keeps the upload well under
// the server's body limit.
const MAX_SECONDS = 120;

type Phase = 'idle' | 'recording' | 'transcribing';

export function VoiceNoteButton({
  onText,
  onNotice,
  disabled = false,
}: {
  onText: (text: string) => void;
  onNotice: (message: string) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [phase, setPhase] = useState<Phase>('idle');
  const [consentVisible, setConsentVisible] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);

  const startRecording = useCallback(async () => {
    const permission = await requestMicPermission();
    if (permission !== 'granted') {
      onNotice(permission === 'blocked' ? MIC_BLOCKED_MESSAGE : MIC_DENIED_MESSAGE);
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
    } catch (err) {
      console.log('VOICE NOTE START FAILED:', err instanceof Error ? err.message : err);
      onNotice("The microphone didn't start. Try again in a moment.");
      setPhase('idle');
    }
  }, [recorder, onNotice]);

  const stopAndTranscribe = useCallback(async () => {
    setPhase('transcribing');
    try {
      await recorder.stop();
      // Hand the microphone back, so the keyboard and other apps can have it.
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      if (!uri) throw new Error('no recording file');
      // expo-file-system's File IS a Blob, so FormData takes it directly. See
      // authedUpload for why the old { uri, name, type } form cannot be used.
      const recording = new File(uri);
      if (!recording.exists || !recording.size) throw new Error('recording file is empty');
      const { text } = await authedUpload<{ text: string }>('/api/transcribe', recording, 'voice-note.m4a');
      if (text) onText(text);
      else onNotice("I couldn't make out any words in that one.");
    } catch (err) {
      console.log('VOICE NOTE FAILED:', err instanceof Error ? err.message : err);
      // WRITTEN WHERE IT CAN BE READ (2026-09-17). A console line on a phone is
      // not evidence anybody can act on, and three rounds of screenshots did not
      // settle which stage was failing. Best effort: a failed log must never
      // become a second failure on top of the first.
      void logClientError('voice_note', err);
      onNotice("That voice note didn't come through. Try again, or type it.");
    } finally {
      setPhase('idle');
    }
  }, [recorder, onText, onNotice]);

  // The ceiling. Stops and transcribes what there is, rather than discarding it.
  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = setTimeout(() => void stopAndTranscribe(), MAX_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [phase, stopAndTranscribe]);

  const onPress = useCallback(() => {
    if (disabled || phase === 'transcribing') return;
    if (phase === 'recording') {
      void stopAndTranscribe();
      return;
    }
    void (async () => {
      let consented = false;
      try {
        consented = await hasVoiceConsent();
      } catch {
        consented = false;
      }
      if (!consented) {
        setConsentVisible(true);
        return;
      }
      await startRecording();
    })();
  }, [disabled, phase, startRecording, stopAndTranscribe]);

  const recording = phase === 'recording';

  return (
    <>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={
          recording ? 'Stop recording voice note' : phase === 'transcribing' ? 'Writing out voice note' : 'Record a voice note'
        }
        accessibilityState={{ disabled, selected: recording, busy: phase === 'transcribing' }}
        hitSlop={Spacing.two}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedView
          type="backgroundElement"
          style={[
            styles.button,
            // Recording is said in the accent colour on the whole button, so it
            // cannot be missed that the phone is listening.
            recording && { backgroundColor: theme.accent },
            disabled && styles.disabled,
          ]}
        >
          {phase === 'transcribing' ? (
            <ActivityIndicator size="small" color={theme.textSecondary} />
          ) : (
            <Ionicons
              name={recording ? 'stop' : 'mic-outline'}
              size={recording ? 14 : 18}
              color={recording ? theme.background : theme.textSecondary}
            />
          )}
        </ThemedView>
      </Pressable>
      <VoiceConsentSheet
        visible={consentVisible}
        busy={consentBusy}
        onAccept={() => {
          void (async () => {
            setConsentBusy(true);
            try {
              await recordVoiceConsent();
            } catch {
              setConsentBusy(false);
              setConsentVisible(false);
              onNotice("That didn't save. Try again in a moment.");
              return;
            }
            setConsentBusy(false);
            setConsentVisible(false);
            await startRecording();
          })();
        }}
        onDecline={() => setConsentVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 30,
    height: 30,
    borderRadius: ButtonRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
