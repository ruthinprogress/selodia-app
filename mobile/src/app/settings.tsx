import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DataExport } from '@/components/data-export';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

// Account settings (build item 41 — Part Five, Part Seventeen).
//
// NOT A FOURTH TAB, deliberately. Part Five's Screen Structure is explicit that
// there are "three top-level destinations, deliberately kept to three rather
// than more". Settings is not a destination someone visits to use the app; it
// is the standard account surface Part Ten sets aside as "separate and
// standard, not folded into the Almanac". So it lives on the root stack, pushed
// over the tabs and dismissed back to them.
//
// CONTENTS ARE EXACTLY WHAT THE SPEC NAMES — settings, sign-out, export,
// deletion — and nothing else. There is no notification toggle, no theme
// switch, no units preference here. Part Twelve is blunt that a "pause
// check-ins" toggle would turn a caring gesture into cold administration, and
// the same reasoning rules out inventing a settings menu the product has not
// asked for. This page grows when the spec says it does.
//
// Deletion arrives in the next slice, deliberately NOT stubbed here: an inert
// row that does nothing when tapped is exactly the dead control principle 8
// rules out, and shipping one to "reserve the space" would be worse than the
// space being empty for a day.

export default function SettingsScreen() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  // SIGN-OUT WAS NEVER CALLED ANYWHERE. Until this screen existed, `signOut`
  // appeared nowhere in the codebase: someone who signed in had no way out of
  // the app at all, on any screen. The auth guard already watches for the
  // session ending and sends the person to consent, so this only has to end it
  // — no manual navigation, and no race between the two.
  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch {
      // If it fails the session is still live and the person is still here,
      // which is the honest outcome. Re-enable so they can try again.
      setSigningOut(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="title">Settings</ThemedText>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Close settings"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedText type="small" themeColor="link">
                Done
              </ThemedText>
            </Pressable>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Your account</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
              Signing out leaves everything where it is. Your data stays on your
              account, and signing back in picks up exactly where you left off.
            </ThemedText>

            <Pressable
              onPress={handleSignOut}
              disabled={signingOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedView type="backgroundSelected" style={styles.action}>
                <ThemedText type="smallBold">
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </ThemedText>
              </ThemedView>
            </Pressable>
          </ThemedView>

          {/* Entry point one of the two Part Five requires. */}
          <DataExport />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.one,
  },
  body: { lineHeight: 20 },
  action: {
    alignSelf: 'flex-start',
    marginTop: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  pressed: { opacity: 0.6 },
});
