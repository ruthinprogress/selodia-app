import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatBubble } from '@/components/chat-bubble';
import { ResourceCard } from '@/components/resource-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { advanceOnboardingStep } from '@/lib/onboarding-step';
import { requestStepPermission, type StepPermissionResult } from '@/lib/step-permission';
import { supabase } from '@/lib/supabase';

// Part Seven, steps 4-5. Hybrid by design (see the phase-4 follow-up plan):
// the two boolean facts stay button-driven and the native step permission stays a
// real OS prompt — both far more reliable than parsing free text — while the
// warmth, the gap-handling ("no scales? we just start with food"), and any device
// questions ("does my Fitbit scale count?") are AI-driven via the 'equipment'
// phase. The booleans are persisted client-side; the route only generates text.

type Message = {
  role: 'user' | 'assistant';
  content: string;
  resourceCard?: { title: string; description: string; url: string } | null;
};

type Step = 'scales' | 'tapeMeasure' | 'acknowledge' | 'permissionIntro' | 'permission' | 'done';

// Fixed opening segue + first equipment question (D4): the personalised
// acknowledgement of what they shared already happened one screen earlier, in the
// intro phase, so this opener stays a stable, on-spec line.
const OPENING_LINE =
  "Now, the first step is just getting a little visibility on your body — that's what makes the numbers mean something later on. To start: do you have bioimpedance scales? The kind that read body fat and muscle, not just weight.";
const TAPE_QUESTION = 'And do you have a tape measure?';
const PERMISSION_INTRO =
  "One more thing — I can read your step count straight from your phone's health data, so movement counts without you having to log it. I'll ask your phone for permission next.";
// Permission-result copy stays canned (D5): the fallback line is quoted verbatim
// in the spec (Part Seven, step 4).
const PERMISSION_GRANTED = 'Got it — step tracking is connected.';
const PERMISSION_FALLBACK =
  "No worries — maybe you have a tracker that doesn't sync to your phone's health app, like some cheaper fitness watches. You can just tell me your step count from its own app directly, or send a screenshot.";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

function gearSummary(scales: boolean | null, tape: boolean): string {
  if (scales && tape) return 'I have both bioimpedance scales and a tape measure.';
  if (scales && !tape) return 'I have bioimpedance scales but not a tape measure.';
  if (!scales && tape) return 'I have a tape measure but not bioimpedance scales.';
  return "I don't have bioimpedance scales or a tape measure.";
}

export default function EquipmentScreen() {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: OPENING_LINE }]);
  const [step, setStep] = useState<Step>('scales');
  const [hasScales, setHasScales] = useState<boolean | null>(null);
  const [hasTapeMeasure, setHasTapeMeasure] = useState<boolean | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) advanceOnboardingStep(supabase, user.id, 'equipment');
    });
  }, []);

  // Single path to the 'equipment' phase, used both for the gear acknowledgement
  // (synthetic summary, not shown as a user bubble to avoid duplicating the Yes/No
  // bubbles) and for free-text questions (shown).
  async function postToRoute(message: string, showUser: boolean) {
    if (showUser) setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setSending(true);
    try {
      if (!API_BASE_URL) throw new Error('Backend URL not configured');
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');

      const response = await fetch(`${API_BASE_URL}/api/onboarding-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message, phase: 'equipment' }),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Request failed (${response.status}): ${body}`);
      }
      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply, resourceCard: data.resourceCard },
      ]);
    } catch (err) {
      console.error('Equipment chat failed:', err instanceof Error ? err.message : err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Something went wrong on my end — mind trying that again?" },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleScalesAnswer(value: boolean) {
    setHasScales(value);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: value ? 'Yes' : 'No' },
      { role: 'assistant', content: TAPE_QUESTION },
    ]);
    setStep('tapeMeasure');
  }

  async function handleTapeAnswer(value: boolean) {
    setHasTapeMeasure(value);
    setMessages((prev) => [...prev, { role: 'user', content: value ? 'Yes' : 'No' }]);
    setStep('acknowledge');
    // AI acknowledgement + gap-handling, from their actual answers.
    await postToRoute(gearSummary(hasScales, value), false);
    setMessages((prev) => [...prev, { role: 'assistant', content: PERMISSION_INTRO }]);
    setStep('permissionIntro');
  }

  async function persistAnswers(permission: StepPermissionResult) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_profile').upsert({
      user_id: user.id,
      has_scales: hasScales,
      has_tape_measure: hasTapeMeasure,
      steps_permission_declined: permission !== 'granted',
    });
    await advanceOnboardingStep(supabase, user.id, 'goals');
  }

  async function requestPermissionStep() {
    setStep('permission');
    const result = await requestStepPermission();
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: result === 'granted' ? PERMISSION_GRANTED : PERMISSION_FALLBACK },
    ]);
    await persistAnswers(result);
    setStep('done');
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setInput('');
    await postToRoute(trimmed, true);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {messages.map((m, i) => (
            <ThemedView key={i} style={styles.messageGroup}>
              <ChatBubble role={m.role}>{m.content}</ChatBubble>
              {m.resourceCard && (
                <ResourceCard
                  title={m.resourceCard.title}
                  description={m.resourceCard.description}
                  url={m.resourceCard.url}
                />
              )}
            </ThemedView>
          ))}

          {(sending || step === 'permission') && <ChatBubble role="assistant">…</ChatBubble>}
        </ScrollView>

        {step === 'scales' && (
          <QuickReplyRow onYes={() => handleScalesAnswer(true)} onNo={() => handleScalesAnswer(false)} />
        )}
        {step === 'tapeMeasure' && (
          <QuickReplyRow onYes={() => handleTapeAnswer(true)} onNo={() => handleTapeAnswer(false)} />
        )}
        {step === 'permissionIntro' && (
          <Pressable
            onPress={() => requestPermissionStep()}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.continueButton}>
              <ThemedText type="smallBold">Continue to permission request</ThemedText>
            </ThemedView>
          </Pressable>
        )}
        {step === 'done' && (
          <Pressable
            onPress={() => router.push('/onboarding/goals')}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.continueButton}>
              <ThemedText type="smallBold">Continue</ThemedText>
            </ThemedView>
          </Pressable>
        )}

        <ThemedView style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Any questions? Ask here…"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            multiline
            editable={!sending}
          />
          <Pressable onPress={handleSend} disabled={sending} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundSelected" style={styles.sendButton}>
              <ThemedText type="smallBold">Send</ThemedText>
            </ThemedView>
          </Pressable>
        </ThemedView>
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
  messageGroup: {
    gap: Spacing.two,
  },
  quickReplyRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  quickReplyButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    maxHeight: 100,
  },
  sendButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  continueButton: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
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
