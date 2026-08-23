import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Checkbox } from '@/components/checkbox';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function ConsentScreen() {
  const [coreConsent, setCoreConsent] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [researchOptIn, setResearchOptIn] = useState(false);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Before we start</ThemedText>

        <ThemedText>
          Unflump asks about things like your food, weight, body measurements and activity so it
          can actually understand you — not just log numbers. This is health data, so we want to
          be upfront: it&apos;s yours, it&apos;s kept secure, and it&apos;s never sold or shared.
        </ThemedText>

        <ThemedText>
          Unflump isn&apos;t a medical service and doesn&apos;t replace advice from your doctor —
          think of it as a very attentive companion for the day-to-day. You can delete your data
          at any time.
        </ThemedText>

        <ThemedView style={styles.checkboxGroup}>
          <Checkbox
            checked={coreConsent}
            onToggle={() => setCoreConsent((v) => !v)}
            label="I understand and agree to Unflump collecting and using my health data as described, and I've read the Privacy Policy."
          />
          <Checkbox
            checked={marketingOptIn}
            onToggle={() => setMarketingOptIn((v) => !v)}
            label="Keep me posted with occasional tips and updates from Unflump"
          />
          <Checkbox
            checked={researchOptIn}
            onToggle={() => setResearchOptIn((v) => !v)}
            label="I'm happy for de-identified data from my use of Unflump to be used to help improve the product and understand patterns across users — separate from selling data, which Unflump never does."
          />
        </ThemedView>

        <Pressable
          disabled={!coreConsent}
          onPress={() => router.push('/onboarding/account')}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView
            type={coreConsent ? 'backgroundSelected' : 'backgroundElement'}
            style={styles.continueButton}>
            <ThemedText type="smallBold" themeColor={coreConsent ? 'text' : 'textSecondary'}>
              Continue
            </ThemedText>
          </ThemedView>
        </Pressable>
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
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
