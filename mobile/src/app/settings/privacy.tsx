import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';

import { ConsentChoices } from '@/components/consent-choices';
import { SettingsGroup, SettingsPage, SettingsRow } from '@/components/settings-page';

// PRIVACY (2026-09-20): what was agreed to, what is remembered, and the way
// out. Deletion lives on the Data page with the export, because somebody about
// to erase everything should pass the offer of a copy on the way - the ordering
// the old single page already had, kept deliberately.
export default function PrivacyScreen() {
  return (
    <SettingsPage
      title="Privacy"
      subtitle="Your data, and what Selodía is allowed to do with it."
      footer="Your data. Your choice. Always."
    >
      <ConsentChoices />

      <SettingsGroup>
        <SettingsRow
          first
          icon="document-text-outline"
          label="Privacy policy"
          detail="What is collected, who sees it, and how long it is kept"
          onPress={() => void WebBrowser.openBrowserAsync('https://selodia.app/privacy')}
        />
        <SettingsRow
          icon="cloud-download-outline"
          label="Data and export"
          detail="Take a copy, or delete everything"
          onPress={() => router.push('/settings/data')}
        />
      </SettingsGroup>
    </SettingsPage>
  );
}
