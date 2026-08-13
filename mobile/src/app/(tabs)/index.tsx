import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatBubble } from '@/components/chat-bubble';
import { HealthDisclaimer } from '@/components/health-disclaimer';
import { ResourceCard } from '@/components/resource-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  resourceCard?: { title: string; description: string; url: string } | null;
  healthGuidanceApplied?: boolean;
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const FALLBACK_ERROR = "Something went wrong on my end — mind trying that again?";
const NOT_SIGNED_IN_ERROR = "You're not signed in — please sign in and try again.";

export default function ChatScreen() {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('source', 'chat')
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data.map((m) => ({ role: m.role, content: m.content })));
      }
      setLoadingHistory(false);
    })();
  }, []);

  async function authedFetch(path: string, body: Record<string, unknown>) {
    if (!API_BASE_URL) throw new Error('Backend URL not configured');

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error('Not signed in');

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${path} failed (${response.status}): ${body}`);
    }
    return response.json();
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setSending(true);

    try {
      // Every chat message goes through the single safety-first handler
      // (ask-unflump / B-merged-single). It classifies safety AND log intent,
      // stores any food/activity silently, and returns the safety-governed
      // reply - so a message can never be routed straight to a bare "Logged:"
      // and bypass the safety classifier the way the old classify-message
      // router allowed. Photo/screenshot logging still uses parse-food /
      // parse-activity directly, outside this text path.
      const { reply, resourceCard, healthGuidanceApplied } = await authedFetch('/api/ask-unflump', {
        message: trimmed,
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply, resourceCard, healthGuidanceApplied },
      ]);
    } catch (err) {
      console.error('Chat send failed:', err instanceof Error ? err.message : err);
      const content = err instanceof Error && err.message === 'Not signed in' ? NOT_SIGNED_IN_ERROR : FALLBACK_ERROR;
      setMessages((prev) => [...prev, { role: 'assistant', content }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {!loadingHistory && messages.length === 0 && (
            <ChatBubble role="assistant">
              What did you eat, what did you do, or what&apos;s on your mind?
            </ChatBubble>
          )}

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
              {m.healthGuidanceApplied && <HealthDisclaimer />}
            </ThemedView>
          ))}

          {sending && <ChatBubble role="assistant">…</ChatBubble>}
        </ScrollView>

        <ThemedView style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type here…"
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
  pressed: {
    opacity: 0.7,
  },
});
