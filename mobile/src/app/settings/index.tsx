import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { SettingsGroup, SettingsPage, SettingsRow } from '@/components/settings-page';
import { SpotlightTarget } from '@/components/spotlight-target';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

// THE SETTINGS HUB (2026-09-20), rebuilt from Ruth's IA brief.
//
// It was one page holding everything - sign-out, step tracking, consent, export
// and deletion in a column - and her diagnosis was that this made it feel
// unfinished: "The issue isn't the design - it feels too small because we're
// treating it as a single page rather than the entry point into all
// account-level configuration."
//
// So it is a hub now, and the test it has to keep passing is hers: when a new
// feature arrives, where it belongs should be obvious. Connect a watch ->
// Connected devices. Change a reminder -> Notifications. Change units ->
// Profile.
//
// WHAT IS DELIBERATELY NOT HERE. Appearance, which the brief lists: the app is
// light-only by decision (see use-theme.ts) and text size follows the phone, so
// the page would hold nothing but a heading. Principle 8 rules out a control
// that does nothing, and that applies to a page as much as a switch. It arrives
// with the first thing it can actually change.
//
// THE ALMANAC'S ME PAGE STAYS WHERE IT IS, at her instruction: "Please do not
// move the Almanac 'Me' page into Settings ... it's my externalised memory",
// where this is configuration. Two different things, two different homes.
export default function SettingsHub() {
  const [signingOut, setSigningOut] = useState(false);

  // SIGN-OUT WAS NEVER CALLED ANYWHERE before this screen existed: somebody who
  // signed in had no way out of the app at all. The auth guard watches for the
  // session ending and takes it from there, so this only has to end it.
  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <SettingsPage
      subtitle="Personalise your experience and manage your account."
      back={false}
      footer="Small settings support big change."
    >
      <SettingsGroup>
        <SettingsRow
          first
          mark="figure"
          label="Profile"
          detail="Your details and goals"
          onPress={() => router.push('/settings/profile')}
        />
        <SettingsRow
          icon="phone-portrait-outline"
          label="Connected devices"
          detail="Your phone's health data"
          onPress={() => router.push('/settings/devices')}
        />
        <SettingsRow
          icon="notifications-outline"
          label="Notifications"
          detail="Reminders and the weekly review"
          onPress={() => router.push('/settings/notifications')}
        />
        <SettingsRow
          icon="lock-closed-outline"
          label="Privacy"
          detail="What you agreed to, and what Selodía remembers"
          onPress={() => router.push('/settings/privacy')}
        />
        {/* The two pointable rows (build item 23). "Where do I get my data"
            pulses the row that leads there rather than a control on a page
            nobody is looking at - see lib/spotlight.ts. */}
        {/* Both pointers end at this row: the export and the deletion now live
            one page deeper, and the row is the step that can be pulsed. The
            registry holds a list per id, so the page's own target takes over
            while it is open - see spotlight-provider.tsx. */}
        <SpotlightTarget id="settings.export" onActivate={() => router.push('/settings/data')}>
          <SpotlightTarget id="settings.delete" onActivate={() => router.push('/settings/data')}>
          <SettingsRow
            icon="cloud-download-outline"
            label="Data and export"
            detail="Take a copy, or delete everything"
            onPress={() => router.push('/settings/data')}
          />
          </SpotlightTarget>
        </SpotlightTarget>
        <SettingsRow
          icon="help-circle-outline"
          label="Help and support"
          detail="Get help or send feedback"
          onPress={() => router.push('/settings/support')}
        />
        <SettingsRow
          icon="information-circle-outline"
          label="About Selodía"
          detail="Version, privacy policy and terms"
          onPress={() => router.push('/settings/about')}
        />
      </SettingsGroup>

      {/* Quiet, and last: leaving is not a setting, and signing out of this app
          loses nothing - the copy on the Profile page says so. */}
      <Pressable
        onPress={() => void handleSignOut()}
        disabled={signingOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
      >
        <ThemedText type="small" themeColor="link">
          {signingOut ? 'Signing out…' : 'Sign out'}
        </ThemedText>
      </Pressable>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  signOut: { alignSelf: 'center' },
  pressed: { opacity: 0.6 },
});
