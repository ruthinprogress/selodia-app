import { makeRedirectUri } from 'expo-auth-session';
import { getQueryParams } from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateOfBirthField } from '@/components/date-of-birth-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type BiologicalSex = 'female' | 'male' | 'prefer_not_to_say';

const SEX_OPTIONS: { value: BiologicalSex; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

// Supabase's OAuth redirect carries tokens in the URL (query or fragment);
// exchanging them for a real session is a manual step on native, unlike web
async function createSessionFromUrl(url: string) {
  const { params, errorCode } = getQueryParams(url);
  if (errorCode) throw new Error(errorCode);
  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return null;
  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return data.session;
}

// user_profile is the permanent home for this data, but RLS requires a real
// session to write it - only reachable here when one exists immediately
// (email confirmation off, or the Google path). When confirmation is
// pending, signUp's metadata is the only viable carrier until a session
// exists later (no auth-state listener yet to sync it on reauth).
async function upsertProfile(userId: string, dob: Date | null, sex: BiologicalSex | null) {
  if (!dob && !sex) return;
  await supabase.from('user_profile').upsert({
    user_id: userId,
    date_of_birth: dob ? dob.toISOString().slice(0, 10) : null,
    biological_sex: sex,
  });
}

export default function AccountScreen() {
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  function toggleMode() {
    setMode((m) => (m === 'signup' ? 'signin' : 'signup'));
    setError(null);
    setInfo(null);
    setPassword('');
    setConfirmPassword('');
    setDateOfBirth(null);
    setBiologicalSex(null);
  }

  async function handleGoogleSignIn() {
    setError(null);
    setInfo(null);
    setGoogleSubmitting(true);
    try {
      const redirectTo = makeRedirectUri();
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (oauthError) throw oauthError;
      if (!data.url) throw new Error('No sign-in URL returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') return;

      const session = await createSessionFromUrl(result.url);
      if (session) {
        await upsertProfile(session.user.id, dateOfBirth, biologicalSex);
        // The auth guard (step 6) is the sole post-auth router: it resumes the
        // user at their onboarding step or sends a finished user to the app.
      } else {
        setError('Sign-in did not complete. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong signing in with Google.');
    } finally {
      setGoogleSubmitting(false);
    }
  }

  async function handleSignIn() {
    setError(null);
    setInfo(null);

    if (!email.trim() || !password) {
      setError('Enter your email and password to sign in.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      // Post-auth routing is the guard's job (step 6) — no manual navigation.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong signing in.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleContinue() {
    if (mode === 'signin') return handleSignIn();

    setError(null);
    setInfo(null);

    if (!email.trim() || !password) {
      setError('Enter an email and password to continue.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords don’t match.');
      return;
    }

    setSubmitting(true);
    try {
      // user_profile (upsertProfile below) is the real destination once a
      // session exists. This metadata copy only matters while email
      // confirmation is pending and no session exists yet to write with.
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // Resolves to wherever this is actually running (web origin vs.
          // native scheme) rather than relying on the project's single
          // global Site URL matching whatever context we're testing in.
          // Still requires the resolved URL to be in Supabase's Redirect
          // URLs allow-list (dashboard-only, no tool access to set it).
          emailRedirectTo: makeRedirectUri(),
          data: {
            date_of_birth: dateOfBirth ? dateOfBirth.toISOString().slice(0, 10) : null,
            biological_sex: biologicalSex,
          },
        },
      });
      if (signUpError) throw signUpError;

      if (data.session) {
        await upsertProfile(data.session.user.id, dateOfBirth, biologicalSex);
        // The auth guard (step 6) routes onward once the session is set.
      } else {
        setInfo('Check your email to confirm your account, then come back to continue.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong creating your account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="subtitle">
            {mode === 'signup' ? 'Create your account' : 'Sign in'}
          </ThemedText>

          <Pressable
            onPress={handleGoogleSignIn}
            disabled={googleSubmitting}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.googleButton}>
              <ThemedText type="smallBold">
                {googleSubmitting ? 'Opening Google…' : 'Continue with Google'}
              </ThemedText>
            </ThemedView>
          </Pressable>

          <ThemedText type="small" themeColor="textSecondary" style={styles.dividerText}>
            or
          </ThemedText>

          <LabeledInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <LabeledInput label="Password" value={password} onChangeText={setPassword} secureTextEntry />

          {mode === 'signup' && (
            <>
              <LabeledInput
                label="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />

              <DateOfBirthField value={dateOfBirth} onChange={setDateOfBirth} />

              <ThemedView style={styles.fieldGroup}>
                <ThemedText type="small" themeColor="textSecondary">
                  Biological sex (used to calculate your calorie needs)
                </ThemedText>
                <ThemedView style={styles.sexOptionsRow}>
                  {SEX_OPTIONS.map((opt) => (
                    <Pressable key={opt.value} onPress={() => setBiologicalSex(opt.value)}>
                      <ThemedView
                        type={biologicalSex === opt.value ? 'backgroundSelected' : 'backgroundElement'}
                        style={styles.sexOption}>
                        <ThemedText
                          type="small"
                          themeColor={biologicalSex === opt.value ? 'text' : 'textSecondary'}>
                          {opt.label}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  ))}
                </ThemedView>
                {biologicalSex === 'prefer_not_to_say' && (
                  <ThemedText type="small" themeColor="textSecondary">
                    We&apos;ll use a general estimate for your calorie needs — it&apos;ll be a bit
                    less precise without this.
                  </ThemedText>
                )}
              </ThemedView>
            </>
          )}

          {error && (
            <ThemedText type="small" themeColor="danger">
              {error}
            </ThemedText>
          )}
          {info && (
            <ThemedText type="small" themeColor="textSecondary">
              {info}
            </ThemedText>
          )}

          <Pressable
            onPress={handleContinue}
            disabled={submitting}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.continueButton}>
              <ThemedText type="smallBold">
                {mode === 'signup'
                  ? submitting
                    ? 'Creating account…'
                    : 'Continue'
                  : submitting
                    ? 'Signing in…'
                    : 'Sign in'}
              </ThemedText>
            </ThemedView>
          </Pressable>

          <Pressable onPress={toggleMode} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.dividerText}>
              {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function LabeledInput({ label, style, ...rest }: TextInputProps & { label: string }) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.fieldGroup}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        {...rest}
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }, style]}
        placeholderTextColor={theme.textSecondary}
      />
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
  scrollContent: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
    gap: Spacing.four,
  },
  googleButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  dividerText: {
    textAlign: 'center',
  },
  fieldGroup: {
    gap: Spacing.two,
  },
  input: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  sexOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  sexOption: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  continueButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
