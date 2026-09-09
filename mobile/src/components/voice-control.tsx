import { useEffect } from 'react';

import { useConversation } from '@elevenlabs/react-native';

import { VoiceButton } from '@/components/voice-button';
import { VoiceConsentSheet } from '@/components/voice-consent-sheet';
import { VoiceSessionScreen } from '@/components/voice-session-screen';
import { useVoiceStart } from '@/lib/use-voice-start';

// The whole voice affordance behind one component: the mic, the consent sheet,
// and the sequence that connects them.
//
// IT OWNS THE HOOK SO THE CHAT SCREEN DOES NOT. useVoiceStart calls
// useConversation, which reaches into the SDK - and a hook called directly in
// Chat would pull the whole WebRTC stack into the web bundle even with the
// button hidden. Keeping it here means one file to swap out on web, and Chat
// imports something that is safe on every platform.
export function VoiceControl({
  onNotice,
  disabled,
}: {
  onNotice: (message: string) => void;
  disabled?: boolean;
}) {
  const voice = useVoiceStart();
  const { notice, clearNotice } = voice;
  // Read here rather than inside the screen so the screen stays a pure
  // rendering of a state it is handed, and can be looked at in isolation.
  const { status, mode, endSession } = useConversation();

  // In an effect, not in render. Handing the message up during render would be
  // a side effect in a render pass - it would fire again on every re-render
  // before the clear landed, and the toast would repeat.
  useEffect(() => {
    if (!notice) return;
    onNotice(notice);
    clearNotice();
  }, [notice, onNotice, clearNotice]);

  return (
    <>
      <VoiceButton onRequestStart={voice.begin} disabled={disabled} />
      {/* The session's own state lives here, full screen, rather than in a
          36pt icon that could not carry it (see voice-button.tsx). */}
      <VoiceSessionScreen
        visible={status !== 'disconnected'}
        speaking={mode === 'speaking'}
        connecting={status === 'connecting'}
        onClose={endSession}
      />
      <VoiceConsentSheet
        visible={voice.consentVisible}
        busy={voice.consentBusy}
        onAccept={voice.acceptConsent}
        onDecline={voice.declineConsent}
      />
    </>
  );
}
