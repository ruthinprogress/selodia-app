import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingActionProvider } from '@/components/onboarding-action';
import { OnboardingHeader } from '@/components/onboarding-header';
import { ThemedView } from '@/components/themed-view';

// The onboarding group's own layout, added so the progress header lives in ONE
// place rather than being repeated across nine screens. The header sits above
// the Stack so it persists across the push-chain instead of animating in and
// out with each step — the point is continuity, and a header that slid away
// with every transition would undercut it.
export default function OnboardingLayout() {
  return (
    // The action provider wraps BOTH the header and the Stack: the screens
    // inside register the forward action, the header outside renders it. That is
    // the whole reason it is a context - the header deliberately lives above the
    // Stack so it persists across the push-chain, which puts it out of reach of
    // any screen's props.
    <OnboardingActionProvider>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <OnboardingHeader />
          <Stack screenOptions={{ headerShown: false, contentStyle: styles.transparent }} />
        </SafeAreaView>
      </ThemedView>
    </OnboardingActionProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  transparent: { backgroundColor: 'transparent' },
});
