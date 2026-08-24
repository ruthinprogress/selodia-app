import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatBubble } from '@/components/chat-bubble';
import { ResourceCard } from '@/components/resource-card';
import { SaveConfirmation } from '@/components/save-confirmation';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { advanceOnboardingStep } from '@/lib/onboarding-step';
import { supabase } from '@/lib/supabase';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  resourceCard?: { title: string; description: string; url: string } | null;
};

const OPENING_LINE =
  "Let's talk about what you're hoping to get out of this — how are you feeling about things right now?";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export default function GoalsScreen() {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [saveToast, setSaveToast] = useState<{ summary: string; nonce: number } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) advanceOnboardingStep(supabase, user.id, 'goals');
    });
  }, []);

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
        body: JSON.stringify({ message: trimmed }),
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
      if (data.saved?.summary) {
        setSaveToast((prev) => ({ summary: data.saved.summary, nonce: (prev?.nonce ?? 0) + 1 }));
      }
    } catch (err) {
      console.error('Goals chat send failed:', err instanceof Error ? err.message : err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Something went wrong on my end — mind trying that again?" },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
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
        </ScrollView>

        {messages.length > 0 && (
          <Pressable
            onPress={() => router.push('/onboarding/health-context')}
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
            placeholder="Type your answer…"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            multiline
            editable={!sending}
          />
          <Pressable
            onPress={handleSend}
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
  sendDisabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
