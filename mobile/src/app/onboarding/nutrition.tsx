import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatBubble } from '@/components/chat-bubble';
import { useOnboardingAction } from '@/components/onboarding-action';
import { ConversationLayout } from '@/components/conversation-layout';
import { ResourceCard } from '@/components/resource-card';
import { SaveConfirmation } from '@/components/save-confirmation';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useChatScroll } from '@/hooks/use-chat-scroll';
import { useTheme } from '@/hooks/use-theme';
import { advanceOnboardingStep } from '@/lib/onboarding-step';
import { supabase } from '@/lib/supabase';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  resourceCard?: { title: string; description: string; url: string } | null;
};

// Step 10 (UNFLUMP_SPEC.md, Part Seven): confirm an explicit yes, then collect
// height/weight so the route can state a protein target tied to today's logged
// intake. The number is built deterministically server-side (never the model);
// this screen only relays the conversation and waits for phaseComplete — the
// signal that the target statement actually landed — before offering Continue.
const OPENING_LINE =
  "Now that I understand where you're headed, we can work out a daily protein target that fits you — it's one of the most useful numbers to have on hand. Want to do that now?";

// Sent verbatim as the person's message. "I'll start with a number" is
// deliberately not a command the app interprets - it goes to the model like any
// other sentence, which keeps one path through this step instead of two.
const PROTEIN_CHOICES = ["I'll start with a number", 'Tell me more'] as const;

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export default function NutritionScreen() {
  // Destructured here rather than read as chatScroll.ref inside the JSX:
  // with the React Compiler on, a property access on the returned object
  // during render trips react-hooks/refs, which cannot tell it apart from
  // reading .current. Passing a ref BINDING to ref= is the sanctioned shape.
  const { ref: scrollRef, onContentSizeChange: onThreadGrew } = useChatScroll();
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [phaseComplete, setPhaseComplete] = useState(false);
  // Set on the turn that offers the protein range. Two shortcuts, not a gate:
  // typing a number, or anything else, works exactly as well.
  const [proteinChoice, setProteinChoice] = useState(false);
  const [saveToast, setSaveToast] = useState<{ summary: string; nonce: number } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) advanceOnboardingStep(supabase, user.id, 'nutrition_targets');
    });
  }, []);

  async function handleSend(override?: string) {
    const trimmed = (override ?? input).trim();
    if (!trimmed || sending) return;
    if (override === undefined) setInput('');
    // The offer has been answered either way, so the chips go.
    setProteinChoice(false);
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
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
        body: JSON.stringify({ message: trimmed, phase: 'nutrition_targets' }),
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
      if (data.phaseComplete) setPhaseComplete(true);
      if (data.proteinChoiceOpen) setProteinChoice(true);
      if (data.saved?.summary) {
        setSaveToast((prev) => ({ summary: data.saved.summary, nonce: (prev?.nonce ?? 0) + 1 }));
      }
    } catch (err) {
      console.error('Nutrition chat send failed:', err instanceof Error ? err.message : err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Something went wrong on my end — mind trying that again?" },
      ]);
    } finally {
      setSending(false);
    }
  }

  useOnboardingAction({
    label: 'Continue',
    enabled: phaseComplete,
    onPress: () => router.push('/onboarding/activity'),
  });

  return (
    <ConversationLayout>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          ref={scrollRef}
          onContentSizeChange={onThreadGrew}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <ChatBubble role="assistant">{OPENING_LINE}</ChatBubble>

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

          {sending && <ChatBubble role="assistant">…</ChatBubble>}

          {/* Two ways forward from the range, sent as the person's own words -
              the model reads "Tell me more" exactly as if they had typed it.
              Not a gate: the message box is right there, and a number typed
              straight in works identically. */}
          {proteinChoice && !sending && (
            <ThemedView style={styles.choiceRow}>
              {PROTEIN_CHOICES.map((label) => (
                <Pressable
                  key={label}
                  onPress={() => void handleSend(label)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <ThemedView type="backgroundElement" style={styles.choiceChip}>
                    <ThemedText type="small">{label}</ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>
          )}
        </ScrollView>

        <ThemedView style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type your answer…"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            multiline
            editable={!sending}
          />
          <Pressable
            onPress={() => handleSend()}
            // Empty input previously did nothing at all - no message, no re-ask,
            // nothing - so Send looked pressable and behaved dead. Disabling it
            // lets the control state the truth instead of failing silently. A
            // "please type something" nag would be the other option and is worse:
            // scolding someone for a tap that should never have been offered.
            disabled={sending || input.trim().length === 0}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedView
              type="backgroundSelected"
              style={[styles.sendButton, (sending || input.trim().length === 0) && styles.sendDisabled]}
            >
              <ThemedText type="smallBold">Send</ThemedText>
            </ThemedView>
          </Pressable>
        </ThemedView>

        <SaveConfirmation summary={saveToast?.summary ?? null} nonce={saveToast?.nonce ?? 0} />
      </SafeAreaView>
    </ConversationLayout>
  );
}

const styles = StyleSheet.create({
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
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  choiceChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  messageGroup: {
    gap: Spacing.two,
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
  sendDisabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
