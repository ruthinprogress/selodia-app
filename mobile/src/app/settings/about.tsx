import { APP_NAME, TAGLINE } from '@/lib/brand';
import * as WebBrowser from 'expo-web-browser';

import { BuildVersion } from '@/components/build-version';
import { SettingsGroup, SettingsPage, SettingsRow } from '@/components/settings-page';
import { ThemedText } from '@/components/themed-text';

// ABOUT (2026-09-20). Version, and the documents somebody is entitled to read.
// Release notes and licences are in her brief and are not written yet; they
// join this page when they exist rather than as empty rows.
export default function AboutScreen() {
  return (
    // THE TAGLINE COMES FROM lib/brand.ts, not from here. This screen carried its
    // own copy of a line that has been settled since 31 August, and it was the
    // wrong one.
    <SettingsPage title={`About ${APP_NAME}`} subtitle={TAGLINE}>
      <ThemedText type="small" themeColor="textSecondary" style={{ lineHeight: 20 }}>
        Selodía is a body-literacy companion: it holds what you tell it about your body, your food
        and your movement, and helps you notice what your own data is saying. It is not a medical
        service and does not replace advice from your doctor.
      </ThemedText>

      <SettingsGroup>
        <SettingsRow
          first
          icon="document-text-outline"
          label="Privacy policy"
          onPress={() => void WebBrowser.openBrowserAsync('https://selodia.app/privacy')}
        />
        <SettingsRow
          icon="help-buoy-outline"
          label="Support"
          onPress={() => void WebBrowser.openBrowserAsync('https://selodia.app/support')}
        />
        <SettingsRow
          icon="trash-outline"
          label="Deleting your account"
          detail="How to ask, with or without the app"
          onPress={() => void WebBrowser.openBrowserAsync('https://selodia.app/delete-account')}
        />
      </SettingsGroup>

      <BuildVersion />
    </SettingsPage>
  );
}
