import { getQueryParams } from 'expo-auth-session/build/QueryParams';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

// SETTING A NEW PASSWORD, from the link in the email (Ruth, 27 September 2026:
// "build it now, before any beta tester is on the app").
//
// WHAT THE LINK ACTUALLY DOES. Supabase's recovery email points at its own
// /auth/v1/verify, which validates the token and then redirects to whatever
// redirectTo asked for - here `selodia://onboarding/reset-password` - with a
// real access and refresh token in the URL. So by the time this screen opens,
// the person is ALREADY AUTHENTICATED. That is the part worth understanding,
// because it is also the danger:
//
// A RECOVERY SESSION IS A REAL SESSION, and the route guard would happily see
// it and send somebody straight into the app with the password they could not
// remember still on the account. They would be in, this once, and locked out
// again the next time. So use-auth-guard.ts leaves this screen alone, the same
// way it leaves the onboarding conversation alone, and this screen does not let
// go until a new password is actually set.
//
// THE TOKENS ARE IN THE URL FRAGMENT, which the router does not hand over as
// params - hence reading the raw URL here rather than useLocalSearchParams.
// Both the initial URL (the app was closed) and the event (it was already open)
// are handled, because which one fires depends on nothing the person did.

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const [stage, setStage] = useState<'opening' | 'ready' | 'expired'>('opening');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function accept(url: string | null) {
      if (!url || cancelled) return;
      const { params, errorCode } = getQueryParams(url);
      if (errorCode) {
        // The commonest one by far is an expired link, and saying so is more
        // use than the code: it tells her what to do next.
        if (!cancelled) setStage('expired');
        return;
      }
      const { access_token, refresh_token } = params;
      if (!access_token || !refresh_token) return;
      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (cancelled) return;
      setStage(sessionError ? 'expired' : 'ready');
    }

    void Linking.getInitialURL().then(accept);
    const sub = Linking.addEventListener('url', (e) => void accept(e.url));

    // A LINK THAT NEVER ARRIVES IS NOT A SPINNER FOREVER. If this screen was
    // reached some other way - a stale route, a tap on a notification - there
    // is nothing to wait for, and saying so beats a wheel that never stops.
    const giveUp = setTimeout(() => {
      if (!cancelled) setStage((s) => (s === 'opening' ? 'expired' : s));
    }, 6000);

    return () => {
      cancelled = true;
      sub.remove();
      clearTimeout(giveUp);
    };
  }, []);

  async function save() {
    setError(null);
    if (password.length < 8) {
      setError('Passwords need to be at least 8 characters.');
      return;
    }
    if (password !== again) {
      setError('Those two do not match.');
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      // Straight in. The session is already hers and the password is now one
      // she chose, so there is nothing left to ask.
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not save. Try once more.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="display">A new password</ThemedText>

          {stage === 'opening' && (
            <ThemedText type="small" themeColor="textSecondary">
              One moment.
            </ThemedText>
          )}

          {stage === 'expired' && (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                That link has expired, or it had already been used. They only last an hour, for
                safety.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Ask for another from the sign-in screen and it will come straight through.
              </ThemedText>
              <ThemedView
                type="backgroundElement"
                style={[styles.button, { borderColor: theme.backgroundSelected }]}>
                <ThemedText
                  type="smallBold"
                  onPress={() => router.replace({ pathname: '/onboarding/account', params: { mode: 'signin' } })}>
                  Back to sign in
                </ThemedText>
              </ThemedView>
            </>
          )}

          {stage === 'ready' && (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                Choose something you will remember. Eight characters or more.
              </ThemedText>

              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">
                  New password
                </ThemedText>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                />
              </View>

              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">
                  And again
                </ThemedText>
                <TextInput
                  value={again}
                  onChangeText={setAgain}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                />
              </View>

              {error && (
                <ThemedText type="small" themeColor="danger">
                  {error}
                </ThemedText>
              )}

              <ThemedView type="backgroundElement" style={styles.button}>
                <ThemedText type="smallBold" onPress={() => void save()}>
                  {saving ? 'Saving…' : 'Save and continue'}
                </ThemedText>
              </ThemedView>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: PageInset.horizontal,
    paddingTop: PageInset.top,
    paddingBottom: PageInset.bottom,
    gap: Spacing.three,
  },
  field: { gap: Spacing.one },
  input: {
    fontSize: 16,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  button: {
    borderRadius: 999,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
});
