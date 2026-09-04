import { useCallback, useState } from 'react';

import { useConversation } from '@elevenlabs/react-native';

import {
  MIC_BLOCKED_MESSAGE,
  MIC_DENIED_MESSAGE,
  hasVoiceConsent,
  recordVoiceConsent,
  requestMicPermission,
} from '@/lib/voice-consent';
import { VOICE_START_FAILED, buildVoiceSessionConfig } from '@/lib/voice-session';

// The order of the gates, which is the whole of this file.
//
//   consent  ->  OS permission  ->  conversation token  ->  session
//
// Each one can stop the sequence, and each stops it differently. Consent
// declined is silent, because "Not now" is an answer and does not need a
// receipt. Permission refused says one line and does not ask again. A failed
// token says a different line, because that one is our fault, not a choice the
// person made.
//
// THE CONSENT SHEET IS SHOWN ONCE, EVER. If the OS permission is denied after
// consent has been given, the answer is the Settings line - never the sheet
// again. Re-showing it would be asking somebody to re-consent to something they
// already agreed to, in order to fix a problem the sheet cannot fix.

export type VoiceStart = {
  begin: () => void;
  consentVisible: boolean;
  consentBusy: boolean;
  acceptConsent: () => void;
  declineConsent: () => void;
  // One line for the thread, or null. The caller clears it once shown.
  notice: string | null;
  clearNotice: () => void;
};

export function useVoiceStart(): VoiceStart {
  const { startSession } = useConversation();
  const [consentVisible, setConsentVisible] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Everything after consent. Separated so both the first-run path and every
  // later long-press reach the identical sequence - a second copy of this would
  // be where the permission check quietly went missing.
  const openSession = useCallback(async () => {
    const permission = await requestMicPermission();
    if (permission !== 'granted') {
      setNotice(permission === 'blocked' ? MIC_BLOCKED_MESSAGE : MIC_DENIED_MESSAGE);
      return;
    }

    try {
      const config = await buildVoiceSessionConfig();
      startSession({
        conversationToken: config.conversationToken,
        customLlmExtraBody: config.customLlmExtraBody,
      });
    } catch (err) {
      // The reason is for us; the person hears one plain sentence. Never the
      // status code, and never the token - which is why the error carries a
      // description rather than the response.
      console.log('VOICE START FAILED:', err instanceof Error ? err.message : err);
      setNotice(VOICE_START_FAILED);
    }
  }, [startSession]);

  const begin = useCallback(() => {
    void (async () => {
      let consented = false;
      try {
        consented = await hasVoiceConsent();
      } catch {
        // hasVoiceConsent already fails closed; this is belt and braces so a
        // throw cannot open a microphone either.
        consented = false;
      }
      if (!consented) {
        setConsentVisible(true);
        return;
      }
      await openSession();
    })();
  }, [openSession]);

  const acceptConsent = useCallback(() => {
    void (async () => {
      setConsentBusy(true);
      try {
        // Stamped BEFORE the OS dialog, deliberately. Consent is to the
        // processing, and it has been given at this point; whether the OS
        // permission then succeeds is a separate question, and a refusal there
        // must not make us ask for consent all over again.
        await recordVoiceConsent();
      } catch (err) {
        console.log('VOICE CONSENT SAVE FAILED:', err instanceof Error ? err.message : err);
        setConsentBusy(false);
        setConsentVisible(false);
        setNotice(VOICE_START_FAILED);
        return;
      }
      setConsentBusy(false);
      setConsentVisible(false);
      await openSession();
    })();
  }, [openSession]);

  const declineConsent = useCallback(() => {
    // Nothing stamped, nothing said. A "you can turn this on later" line here
    // would be the nudge Part Eighteen rules out.
    setConsentVisible(false);
  }, []);

  return {
    begin,
    consentVisible,
    consentBusy,
    acceptConsent,
    declineConsent,
    notice,
    clearNotice: useCallback(() => setNotice(null), []),
  };
}
