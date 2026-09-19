import { SettingsGroup, SettingsPage } from '@/components/settings-page';
import { StepTracking } from '@/components/step-tracking';
import { ThemedText } from '@/components/themed-text';

// CONNECTED DEVICES (2026-09-20). Ruth's brief lists Samsung Health, Garmin,
// Apple Health, Oura and smart scales. One of those is real: the phone's own
// health platform - Health Connect on Android, Apple Health on iPhone - which
// is where a Samsung watch's steps already arrive. Garmin, Oura and scales have
// no integration, and a row saying "Not connected" beside a thing that cannot
// be connected is a promise the app has not kept.
//
// So this page holds what exists and says plainly what does not. Each
// integration gets its row on the day its code does.
export default function DevicesScreen() {
  return (
    <SettingsPage
      title="Connected devices"
      subtitle="What Selodía reads from your phone, and what it leaves alone."
    >
      <StepTracking />

      <SettingsGroup title="Not yet connected">
        <ThemedText type="small" themeColor="textSecondary" style={{ padding: 16, lineHeight: 20 }}>
          Selodía reads steps from your phone&apos;s own health app, which is where a watch or band
          usually sends them. Direct connections to Garmin, Oura, Fitbit and smart scales are not
          built yet. Until they are, a scale reading is logged by photo or in conversation, and it
          is worth exactly as much in your log either way.
        </ThemedText>
      </SettingsGroup>
    </SettingsPage>
  );
}
