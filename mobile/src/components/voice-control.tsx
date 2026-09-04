import { useEffect } from 'react';

import { VoiceButton } from '@/components/voice-button';
import { VoiceConsentSheet } from '@/components/voice-consent-sheet';
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
      <VoiceConsentSheet
        visible={voice.consentVisible}
        busy={voice.consentBusy}
        onAccept={voice.acceptConsent}
        onDecline={voice.declineConsent}
      />
    </>
  );
}
