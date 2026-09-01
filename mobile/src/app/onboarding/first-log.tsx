import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatBubble } from '@/components/chat-bubble';
import { useOnboardingAction } from '@/components/onboarding-action';
import { ConversationLayout } from '@/components/conversation-layout';
import { SaveConfirmation } from '@/components/save-confirmation';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useChatScroll } from '@/hooks/use-chat-scroll';
import { useTheme } from '@/hooks/use-theme';
import { advanceOnboardingStep } from '@/lib/onboarding-step';
import { supabase } from '@/lib/supabase';

// The first-log step (Part Seven, steps 6-7 — build item 45).
//
// THE POINT OF THIS SCREEN is that someone finishes onboarding having already
// logged something. Before it existed, a person completed the whole
// conversation and landed in Chat cold, with the core loop of the app never
// having been done once.
//
// THE ENTRY IS REAL, NOT A DEMO, which the spec is explicit about. Nothing here
// fakes a log or writes a sample: the message goes to the same
// `onboarding-chat` route every other step uses, whose shared prompt already
// sets logIntent and whose handler already calls logFoodFromText. The save
// confirmation is the same component the rest of the app uses, for the same
// reason — this is the real loop, done once, with company.
//
// STEPS 6 AND 7 ARE ONE SCREEN. Step 7 is the acknowledgement OF step 6 and
// arrives in the turn after the log lands, so splitting them would put a resume
// point in the middle of a single exchange.
//
// SKIPPING IS A REAL OPTION, not a discouraged one. Principle 4 requires
// genuinely open phrasing wherever a pause is offered, and the skip advances the
// step exactly as logging does — someone who declines is not left in a lesser
// state, and is never asked twice.

type Message = { role: 'user' | 'assistant'; content: string };

const OPENING_LINE =
  "Before we go further into what you're aiming for — shall we log something? Whatever you've eaten today so far, in your own words. No weighing, no detail, just however you'd say it to a person.";

// Said by the app, not the model: declining should cost nothing and wait on
// nothing, and a round trip to be told "that's fine" would undercut the point.
const SKIP_LINE =
  "That's completely fine — we can come back to it whenever. Nothing here needs to happen today.";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export default function FirstLogScreen() {
  // Destructured rather than read as chatScroll.ref in the JSX: with the React
  // Compiler on, a property access on the returned object during render trips
  // react-hooks/refs. Passing a ref BINDING is the sanctioned shape.
  const { ref: scrollRef, onContentSizeChange: onThreadGrew } = useChatScroll();
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [saveToast, setSaveToast] = useState<{ summary: string; nonce: number } | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) advanceOnboardingStep(supabase, user.id, 'first_log');
    });
  }, []);

  function handleSkip() {
    if (sending || done) return;
    setMessages((prev) => [...prev, { role: 'assistant', content: SKIP_LINE }]);
    setDone(true);
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setInput('');
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
        // The phase is sent explicitly. The route falls back to 'goals' for an
        // unrecognised value, which would quietly give this step the wrong
        // voice — the one place a default is worse than an error.
        body: JSON.stringify({ message: trimmed, phase: 'first_log' }),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Request failed (${response.status}): ${body}`);
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      if (data.saved?.summary) {
        setSaveToast((prev) => ({ summary: data.saved.summary, nonce: (prev?.nonce ?? 0) + 1 }));
      }
      setDone(true);
    } catch (err) {
      console.error('First-log chat send failed:', err instanceof Error ? err.message : err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Something went wrong on my end — mind trying that again?" },
      ]);
    } finally {
      setSending(false);
    }
  }

  // Two actions here, and the skip is the reason the context carries a
  // secondary at all. Part Two principle 4: a skip offered only after someone
  // hesitates is a skip that was hoping not to be taken, so it sits there from
  // the first moment - and it disappears once something has been logged, because
  // by then there is nothing left to skip.
  useOnboardingAction({
    label: 'Continue',
    enabled: done,
    onPress: () => router.push('/onboarding/goals'),
    secondary: done ? undefined : { label: 'Skip for now', onPress: handleSkip },
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
            </ThemedView>
          ))}

          {sending && <ChatBubble role="assistant">…</ChatBubble>}
        </ScrollView>

        {saveToast && <SaveConfirmation summary={saveToast.summary} nonce={saveToast.nonce} />}

        <ThemedView style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Whatever you've eaten today…"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            multiline
            editable={!sending}
          />
          <Pressable
            onPress={handleSend}
            disabled={!input.trim() || sending}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedView type="backgroundElement" style={styles.sendButton}>
              <ThemedText type="smallBold">{sending ? '…' : 'Send'}</ThemedText>
            </ThemedView>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ConversationLayout>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: {
    padding: Spacing.three,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  messageGroup: { gap: Spacing.two },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  input: {
    flex: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    maxHeight: 120,
  },
  sendButton: {
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  pressed: { opacity: 0.6 },
});
