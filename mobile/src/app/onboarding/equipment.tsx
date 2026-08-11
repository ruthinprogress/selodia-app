import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatBubble } from '@/components/chat-bubble';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { advanceOnboardingStep } from '@/lib/onboarding-step';
import { requestStepPermission, type StepPermissionResult } from '@/lib/step-permission';
import { supabase } from '@/lib/supabase';

type Step = 'scales' | 'tapeMeasure' | 'permission' | 'done';

export default function EquipmentScreen() {
  const [step, setStep] = useState<Step>('scales');
  const [hasScales, setHasScales] = useState<boolean | null>(null);
  const [hasTapeMeasure, setHasTapeMeasure] = useState<boolean | null>(null);
  const [permissionResult, setPermissionResult] = useState<StepPermissionResult | null>(null);
  const [requestingPermission, setRequestingPermission] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) advanceOnboardingStep(supabase, user.id, 'equipment');
    });
  }, []);

  async function persistAnswers(tapeMeasure: boolean, permission: StepPermissionResult) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_profile').upsert({
      user_id: user.id,
      has_scales: hasScales,
      has_tape_measure: tapeMeasure,
      steps_permission_declined: permission !== 'granted',
    });
    await advanceOnboardingStep(supabase, user.id, 'goals');
  }

  async function requestPermissionStep(tapeMeasure: boolean) {
    setStep('permission');
    setRequestingPermission(true);
    const result = await requestStepPermission();
    setPermissionResult(result);
    setRequestingPermission(false);
    setStep('done');
    await persistAnswers(tapeMeasure, result);
  }

  function handleScalesAnswer(value: boolean) {
    setHasScales(value);
    setStep('tapeMeasure');
  }

  function handleTapeMeasureAnswer(value: boolean) {
    setHasTapeMeasure(value);
    requestPermissionStep(value);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ChatBubble role="assistant">
            Before we get into it — do you have bioimpedance scales? The kind that measure body
            fat and muscle, not just weight.
          </ChatBubble>

          {hasScales !== null && (
            <>
              <ChatBubble role="user">{hasScales ? 'Yes' : 'No'}</ChatBubble>
              <ChatBubble role="assistant">What about a tape measure?</ChatBubble>
            </>
          )}

          {hasTapeMeasure !== null && (
            <>
              <ChatBubble role="user">{hasTapeMeasure ? 'Yes' : 'No'}</ChatBubble>
              <ChatBubble role="assistant">
                One more thing — Unflump can pull your step count automatically from your phone&apos;s
                health data. I&apos;ll ask for permission now.
              </ChatBubble>
            </>
          )}

          {requestingPermission && <ChatBubble role="assistant">Requesting permission…</ChatBubble>}

          {permissionResult === 'granted' && (
            <ChatBubble role="assistant">Got it — step tracking is connected.</ChatBubble>
          )}

          {(permissionResult === 'declined' || permissionResult === 'unsupported') && (
            <ChatBubble role="assistant">
              No worries — maybe you have a tracker that doesn&apos;t sync to your phone&apos;s
              health app, like some cheaper fitness watches. You can just tell me your step count
              from its own app directly, or send a screenshot.
            </ChatBubble>
          )}
        </ScrollView>

        {step === 'scales' && (
          <QuickReplyRow onYes={() => handleScalesAnswer(true)} onNo={() => handleScalesAnswer(false)} />
        )}
        {step === 'tapeMeasure' && (
          <QuickReplyRow
            onYes={() => handleTapeMeasureAnswer(true)}
            onNo={() => handleTapeMeasureAnswer(false)}
          />
        )}
        {step === 'done' && (
          // Answers are already persisted (persistAnswers) and onboarding_step
          // advanced to 'goals' by this point. Continue still no-ops because
          // goals.tsx (Build Order step 7, Phase B) doesn't exist yet - wired
          // once that screen lands, not deferred indefinitely.
          <Pressable onPress={() => {}} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.continueButton}>
              <ThemedText type="smallBold">Continue</ThemedText>
            </ThemedView>
          </Pressable>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function QuickReplyRow({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <ThemedView style={styles.quickReplyRow}>
      <Pressable onPress={onYes} style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundElement" style={styles.quickReplyButton}>
          <ThemedText type="smallBold">Yes</ThemedText>
        </ThemedView>
      </Pressable>
      <Pressable onPress={onNo} style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundElement" style={styles.quickReplyButton}>
          <ThemedText type="smallBold">No</ThemedText>
        </ThemedView>
      </Pressable>
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
    gap: Spacing.three,
  },
  quickReplyRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  quickReplyButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  continueButton: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  pressed: {
    opacity: 0.7,
  },
});
