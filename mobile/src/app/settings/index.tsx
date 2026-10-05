import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { SettingsGroup, SettingsPage, SettingsRow } from '@/components/settings-page';
import { SpotlightTarget } from '@/components/spotlight-target';
import { BuildStamp } from '@/components/build-stamp';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { betaStatus } from '@/lib/beta';

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

  // BETA FEEDBACK SITS AT THE TOP, and only for beta accounts (Ruth's item 6).
  //
  // "Lives at the top of the More section, and as the first item in the seed
  // menu on every screen" - and the seed menu IS this page, since the mark on
  // every screen opens it. Top of this list is therefore both of those things at
  // once, and two taps from wherever the problem happened.
  //
  // Starts false and turns true, so somebody who is not in the beta never sees
  // it flicker into existence and back.
  const [isBeta, setIsBeta] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void betaStatus().then((s) => {
      if (!cancelled) setIsBeta(s.member);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
      // IT HAS A NAME NOW (Ruth, 5 October 2026): "Add title so they know the
      // name of the screen (especially useful for Beta testers): 'More'. It's
      // not ideal naming but better than nothing and better than settings for
      // now."
      //
      // The title was removed on 24 September, and the reasoning held at the
      // time: calling it Settings was wrong when it holds the profile, the
      // report builder and the data export, and the three-seed mark that opens
      // it means "more" already. What that argument missed is that the mark is
      // learned and the word is not - somebody opening it for the first time
      // arrives at a page with no name, which is the one thing every other page
      // in the app has.
      title="More"
      subtitle="Personalise your experience and manage your account."
      // The chevron, like every other page - see the shell.
      sprig={false}
      footer="Small settings support big change."
    >
      <SettingsGroup>
        <SettingsRow
          first
          mark="figure"
          label="Profile"
          detail="Your name, your height, your date of birth"
          onPress={() => router.push('/settings/profile')}
        />
        {/* WHAT I TRACK (Ruth, 24 September 2026). Directly under Profile,
            because it is the same kind of thing: what this app is for her
            rather than what it does in general. */}
        {/* FIRST AFTER PROFILE, because it is the thing she opens most and the
            thing everything else in the app is built from. */}
        <SettingsRow
          icon="book-outline"
          label="Body Manual"
          detail="Everything you have told Selodía about your body"
          onPress={() => router.push('/settings/body-manual' as never)}
        />
        <SettingsRow
          icon="nutrition-outline"
          label="What I track"
          detail="Which figures show on a food entry"
          onPress={() => router.push('/settings/tracking')}
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
        {isBeta && (
          <SettingsRow
            first
            icon="megaphone-outline"
            label="Beta feedback"
            detail="Anything at all - nothing has to be filled in"
            onPress={() => router.push('/settings/beta-feedback')}
          />
        )}
        {/* ITS OWN ROW, ABOVE HELP (2026-09-28). Reporting something broken is
            not the same errand as finding help, and burying it one level down
            inside "Help and support" is how a beta generates no information. A
            wave-one requirement from the beta checklist. */}
        <SettingsRow
          icon="alert-circle-outline"
          label="Something not right?"
          detail="Tell us what happened - it reaches a person"
          onPress={() => router.push('/settings/feedback')}
        />
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

      {/* LAST THING ON THE SCREEN SHE ACTUALLY OPENS. See build-stamp.tsx:
          the fuller version with a fetch button is on About, one tap further
          in, and tonight that tap was the difference between knowing and
          guessing which bundle her phone was running. */}
      <BuildStamp />
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  signOut: { alignSelf: 'center' },
  pressed: { opacity: 0.6 },
});
