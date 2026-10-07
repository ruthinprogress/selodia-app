import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';

import { VoiceChoice } from '@/components/voice-choice';
import { SettingsGroup, SettingsPage, SettingsRow } from '@/components/settings-page';

// PRIVACY (2026-09-20): what was agreed to, what is remembered, and the way
// out. Deletion lives on the Your data page with the export, because somebody
// about to erase everything should pass the offer of a copy on the way - the
// ordering the old single page already had, kept deliberately.
//
// THE CONSENT TOGGLES MOVED TO "YOUR DATA" (Ruth, 7 October 2026), because what
// her data may be used for is a thing she DOES about her data, and it belongs
// beside taking a copy of it and having it removed.
//
// THEY MOVED RATHER THAN BEING COPIED. Two controls for one fact is a fault this
// repository has had before, and a consent toggle is the worst possible place to
// have it: two switches for one permission means the one she did not touch is
// the one that decides.
//
// The voice choice stays. It is consent to a FEATURE rather than to a use of her
// record, and it was added here because consent has to be as easy to withdraw as
// it was to give.
export default function PrivacyScreen() {
  return (
    <SettingsPage
      title="Privacy"
      subtitle="Your data, and what Selodía is allowed to do with it."
      footer="Your data. Your choice. Always."
    >
      <VoiceChoice />

      <SettingsGroup>
        <SettingsRow
          first
          icon="document-text-outline"
          label="Privacy policy"
          detail="What is collected, who sees it, and how long it is kept"
          onPress={() => void WebBrowser.openBrowserAsync('https://selodia.app/privacy')}
        />
        {/* The path to the consents she used to find here still works, and the
            detail says they are through it rather than leaving her to guess. */}
        <SettingsRow
          icon="cloud-download-outline"
          label="Your data"
          detail="Your copy, what it may be used for, and deleting everything"
          onPress={() => router.push('/settings/data')}
        />
      </SettingsGroup>
    </SettingsPage>
  );
}
