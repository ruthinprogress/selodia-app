import * as WebBrowser from 'expo-web-browser';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { SettingsGroup, SettingsPage } from '@/components/settings-page';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

// WHY SELODÍA ASKS FOR YOUR STEPS (21 September 2026).
//
// THIS SCREEN IS REQUIRED, not decorative. When Selodía asks to read a step
// count on Android, the permission dialog is not Android's and not ours - it
// belongs to Health Connect, Google's own hub for health data. That dialog
// carries a link to the app's explanation of what it does with the data, and
// Google rejects a Health Connect app at review if the link leads nowhere.
// Until today ours led nowhere: the intent filters were in the manifest,
// added automatically by react-native-health-connect, and there was no screen
// behind them.
//
// IT IS ALSO SIMPLY THE RIGHT PLACE FOR THIS. Somebody being asked to hand
// over health data should be able to find out what happens to it AT THE MOMENT
// THEY ARE ASKED, in one tap, rather than by hunting through Settings
// afterwards or taking it on trust.
//
// SO IT IS WRITTEN FOR THE PERSON, NOT FOR THE REVIEWER. Every line says a
// specific true thing about this app. The most important lines are the ones
// about what is NOT read: a list of what an app does not take is worth more
// than any amount of reassurance about what it does.
//
// LIVES OUTSIDE settings/ ON PURPOSE. Health Connect launches it directly, so
// it must not sit inside a stack that would draw a Settings back-arrow over a
// screen the person reached from another app entirely.

const ROWS: { title: string; body: string }[] = [
  {
    title: 'What Selodía reads',
    body:
      'Your daily step count, and nothing else from your health data. It is read from your phone, not from a watch or an account: if a watch or band sends steps to your phone, Selodía sees the total your phone holds.',
  },
  {
    title: 'What it is used for',
    body:
      'One thing. Your steps become part of the picture of how much you moved on a given day, so that what you ate can be read against what you did. It appears on Today, in your Log, and in a weekly roundup if you have those on.',
  },
  {
    title: 'What is never read',
    body:
      'Heart rate, sleep stages, blood pressure, blood glucose, oxygen, weight, cycle data, exercise sessions, location, or anything else in your health app. Selodía asks for steps alone. Everything else it knows about your body, you told it yourself.',
  },
  {
    title: 'Where it goes',
    body:
      'Your step counts are stored in Selodía’s own database against your account, so the app can show you last week as well as today. They are never sold, never used for advertising, and never shared with anyone else.',
  },
  {
    title: 'Turning it off',
    body:
      'You can withdraw this permission at any time, in Health Connect on Android or in the Health app on iPhone, and Selodía will simply stop reading steps. Nothing else about the app stops working, and your own logs are untouched.',
  },
];

export default function HealthDataScreen() {
  const platformNote =
    Platform.OS === 'ios'
      ? 'You can change this at any time in the Health app, under Sharing.'
      : 'You can change this at any time in Health Connect, under App permissions.';

  return (
    <SettingsPage
      title="Steps, and why Selodía asks"
      subtitle="What health data this app reads, what it does with it, and what it never touches."
    >
      {ROWS.map((row) => (
        <SettingsGroup key={row.title} title={row.title}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            {row.body}
          </ThemedText>
        </SettingsGroup>
      ))}

      <SettingsGroup title="The full privacy policy">
        <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
          {platformNote} The complete policy covers everything else Selodía stores on your behalf,
          not only health data.
        </ThemedText>
        <Pressable
          onPress={() => void WebBrowser.openBrowserAsync('https://selodia.app/privacy')}
          accessibilityRole="link"
          accessibilityLabel="Read the full privacy policy"
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          <ThemedText type="small" themeColor="link">
            Read the full privacy policy
          </ThemedText>
        </Pressable>
      </SettingsGroup>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.three, lineHeight: 20 },
  link: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  pressed: { opacity: 0.6 },
});
