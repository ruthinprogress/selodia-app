import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Checkbox } from '@/components/checkbox';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ButtonRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { holdConsent, recordConsent } from '@/lib/consent';
import { supabase } from '@/lib/supabase';

// THE ANSWERS ARE NOW KEPT (build item 51, 2026-09-19). Continue used to do
// nothing but navigate, so for every account Selodia had no record that anybody
// had agreed to it holding their health data. See lib/consent.ts for how the
// answers reach the database before an account exists.
//
// TWO WAYS IN. At the start of onboarding the answers are held until the
// account screen creates a session. With `reconfirm`, the auth guard has sent a
// signed-in account here because nothing was ever recorded for it: the answers
// are written at once and the person goes straight back to the app. Consent is
// asked for, never assumed - including from the accounts that existed before
// this was built.
export default function ConsentScreen() {
  const { reconfirm, changed } = useLocalSearchParams<{ reconfirm?: string; changed?: string }>();
  const reconfirming = reconfirm === '1';
  const policyChanged = reconfirming && changed === '1';
  const [coreConsent, setCoreConsent] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [researchOptIn, setResearchOptIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleContinue() {
    if (!coreConsent || saving) return;
    const answers = {
      coreConsent,
      marketingOptIn,
      researchOptIn,
      givenAt: new Date().toISOString(),
    };

    if (!reconfirming) {
      holdConsent(answers);
      router.push('/onboarding/account');
      return;
    }

    setSaving(true);
    setFailed(false);
    const { data } = await supabase.auth.getUser();
    const ok = data.user ? await recordConsent(data.user.id, answers, 'reconfirm') : false;
    setSaving(false);
    if (!ok) {
      // Said plainly, and they stay here: carrying on without a record is the
      // exact state this screen exists to end.
      setFailed(true);
      return;
    }
    router.replace('/');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* This screen had no ScrollView at all until 2026-09-01, so on a short
            phone the Continue button was simply clipped off the bottom and
            onboarding could not be started. It was the only onboarding screen
            missing one - every sibling already scrolls - which is exactly why it
            went unnoticed: the pattern looked established because it was, in ten
            files out of eleven.

            The button stays INSIDE the ScrollView rather than being pinned
            below it, matching account.tsx, the nearest structural sibling. A
            pinned bar suits the conversational screens, where a growing thread
            sits above a fixed input row. Here the button is the end of a thing
            you read and agree to, so it belongs after the consent text - and
            pinning it would take vertical space away from three long checkbox
            labels on precisely the small screens that were the problem. */}
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <ThemedText type="sectionTitle">
            {reconfirming ? 'One thing before you carry on' : 'Welcome to Selodía'}
          </ThemedText>

          {reconfirming && !policyChanged && (
            <ThemedText>
              Selodía now keeps a record of what you have agreed to, so there is proof it only ever
              holds your health data with your say-so. Nothing about your account has changed. Please
              confirm your choices below.
            </ThemedText>
          )}

          {policyChanged && (
            <ThemedText>
              Our privacy policy has changed since you last agreed to it. It now names every service
              that handles your data, and explains the error reports your phone can send. Please have a
              read, then confirm your choices below.
            </ThemedText>
          )}

          <ThemedText>
            Selodía asks about things like your food, weight, body measurements and activity so it
            can actually understand you, not just log numbers. This is health data, so we want to
            be upfront: it&apos;s yours, it&apos;s kept secure, and it&apos;s never sold.
          </ThemedText>

          {/* SAID ON THE FIRST SCREEN, NOT ONLY IN THE POLICY (2026-09-19). The
              App Store asks that people are told plainly, and agree, before
              their data goes to a third-party AI - and "never shared" was not
              true of the conversation, which is sent to Claude to be answered. */}
          <ThemedText>
            To understand what you write or say, Selodía sends it to Claude, an AI model made by
            Anthropic. If you use voice, what you say goes to ElevenLabs to be turned into text. They
            use it only to reply to you.
          </ThemedText>

          <ThemedText>
            Selodía isn&apos;t a medical service and doesn&apos;t replace advice from your doctor.
            Think of it as a very attentive companion for the day-to-day. You can delete your data
            at any time.
          </ThemedText>

          {/* The checkbox says "I've read the Privacy Policy", so it has to be
              one tap away. It was not linked from anywhere in the app. */}
          <Pressable
            onPress={() => void WebBrowser.openBrowserAsync('https://selodia.app/privacy')}
            accessibilityRole="link"
            accessibilityLabel="Read the privacy policy"
            hitSlop={Spacing.two}
            style={({ pressed }) => [styles.policyLink, pressed && styles.pressed]}>
            <ThemedText type="small" themeColor="accentDeep">
              Read the privacy policy
            </ThemedText>
          </Pressable>

          <ThemedView style={styles.checkboxGroup}>
            <Checkbox
              checked={coreConsent}
              onToggle={() => setCoreConsent((v) => !v)}
              label="I understand and agree to Selodía collecting and using my health data as described, including sending it to the AI services above to reply to me, and I've read the Privacy Policy."
            />
            <Checkbox
              checked={marketingOptIn}
              onToggle={() => setMarketingOptIn((v) => !v)}
              label="Keep me posted with occasional tips and updates from Selodía"
            />
            <Checkbox
              checked={researchOptIn}
              onToggle={() => setResearchOptIn((v) => !v)}
              label="I'm happy for de-identified data from my use of Selodía to be used to help improve the product and understand patterns across users. This is separate from selling data, which Selodía never does."
            />
          </ThemedView>

          <Pressable
            disabled={!coreConsent || saving}
            onPress={() => void handleContinue()}
            accessibilityRole="button"
            accessibilityState={{ disabled: !coreConsent || saving }}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView
              type={coreConsent ? 'backgroundSelected' : 'backgroundElement'}
              style={styles.continueButton}>
              <ThemedText type="smallBold" themeColor={coreConsent ? 'text' : 'textSecondary'}>
                {saving ? 'Saving…' : 'Continue'}
              </ThemedText>
            </ThemedView>
          </Pressable>

          {failed && (
            <ThemedText type="small" themeColor="textSecondary">
              That didn&apos;t save. Check your connection and try again.
            </ThemedText>
          )}

          {/* RETURNING PEOPLE GO STRAIGHT TO SIGN-IN (build item 51). Until now
              the only way to the sign-in form was through the consent boxes, so
              signing in on a new phone meant agreeing all over again. They sign
              in, and are asked here only if nothing was ever recorded. */}
          {!reconfirming && (
            <Pressable
              onPress={() => router.push({ pathname: '/onboarding/account', params: { mode: 'signin' } })}
              accessibilityRole="button"
              accessibilityLabel="Already have an account? Sign in"
              hitSlop={Spacing.two}
              style={({ pressed }) => [styles.signIn, pressed && styles.pressed]}>
              <ThemedText type="small" themeColor="textSecondary">
                Already have an account?{' '}
                <ThemedText type="small" themeColor="accentDeep">
                  Sign in
                </ThemedText>
              </ThemedText>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  // The width cap, padding and gap moved here from safeArea. They have to sit on
  // the CONTENT container, not the ScrollView itself: applied to the scroller
  // they would constrain the viewport and clip again rather than lay out a
  // scrollable column. Same shape as account.tsx and every other onboarding screen.
  scrollContent: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
    gap: Spacing.four,
  },
  checkboxGroup: {
    gap: Spacing.three,
  },
  continueButton: {
    paddingVertical: Spacing.three,
    borderRadius: ButtonRadius,
    alignItems: 'center',
  },
  policyLink: {
    alignSelf: 'flex-start',
  },
  signIn: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
