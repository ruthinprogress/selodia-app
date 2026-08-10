import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatBubble } from '@/components/chat-bubble';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { requestStepPermission, type StepPermissionResult } from '@/lib/step-permission';

type Step = 'scales' | 'tapeMeasure' | 'permission' | 'done';

export default function EquipmentScreen() {
  const [step, setStep] = useState<Step>('scales');
  const [hasScales, setHasScales] = useState<boolean | null>(null);
  const [hasTapeMeasure, setHasTapeMeasure] = useState<boolean | null>(null);
  const [permissionResult, setPermissionResult] = useState<StepPermissionResult | null>(null);
  const [requestingPermission, setRequestingPermission] = useState(false);

  async function requestPermissionStep() {
    setStep('permission');
    setRequestingPermission(true);
    const result = await requestStepPermission();
    setPermissionResult(result);
    setRequestingPermission(false);
    setStep('done');
  }

  function handleScalesAnswer(value: boolean) {
    setHasScales(value);
    setStep('tapeMeasure');
  }

  function handleTapeMeasureAnswer(value: boolean) {
    setHasTapeMeasure(value);
    requestPermissionStep();
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
          // Onboarding's scripted-shell portion ends here (Part Seven steps 1-5).
          // Steps 6-11 (food-logging tour, first-log ack, goals, target-setting,
          // activity/TDEE) all fundamentally require real language understanding
          // (paraphrasing freeform answers, the distress-vs-discouragement safety
          // branch, reasoning-dependent target adjustments) - none are honestly
          // scriptable. Deferred as one block to Build Order step 6 (real
          // AI-driven conversation); Continue intentionally no-ops until then.
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
