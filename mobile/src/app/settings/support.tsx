import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

import { SettingsGroup, SettingsPage, SettingsRow } from '@/components/settings-page';

// HELP AND SUPPORT (2026-09-20). Her brief lists FAQ, feedback and contact.
// There is no FAQ yet, and an empty one would be worse than none, so this is
// the two that are real: a person to write to, and the support page the app
// stores will link to.
export default function SupportScreen() {
  return (
    <SettingsPage
      title="Help and support"
      subtitle="Something not working, or an idea? A person reads every message."
      footer="Thank you for being here."
    >
      <SettingsGroup>
        <SettingsRow
          first
          icon="mail-outline"
          label="Email us"
          detail="hello@selodia.app"
          onPress={() => void Linking.openURL('mailto:hello@selodia.app')}
        />
        <SettingsRow
          icon="chatbubble-ellipses-outline"
          label="Send feedback"
          detail="What worked, what did not, what you wish it did"
          onPress={() =>
            void Linking.openURL('mailto:hello@selodia.app?subject=Selod%C3%ADa%20feedback')
          }
        />
        <SettingsRow
          icon="open-outline"
          label="Support page"
          detail="selodia.app/support"
          onPress={() => void WebBrowser.openBrowserAsync('https://selodia.app/support')}
        />
      </SettingsGroup>
    </SettingsPage>
  );
}
