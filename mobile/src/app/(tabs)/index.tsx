import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatBubble } from '@/components/chat-bubble';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type Message = {
  role: 'user' | 'assistant';
  content: string;
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

  async function logChatTurns(turns: { role: 'user' | 'assistant'; content: string }[]) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('chat_messages')
      .insert(turns.map((t) => ({ user_id: user.id, role: t.role, content: t.content, source: 'chat' })));
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setInput('');
    const priorMessages = messages;
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setSending(true);

    try {
      const { intent } = await authedFetch('/api/classify-message', { message: trimmed });

      if (intent === 'food') {
        const entry = await authedFetch('/api/parse-food', { foodText: trimmed });
        const reply = `Logged: ${entry.meal_label} — ${entry.kcal} kcal, ${entry.protein_g}g protein, ${entry.carbs_g}g carbs, ${entry.fat_g}g fat.`;
        await logChatTurns([
          { role: 'user', content: trimmed },
          { role: 'assistant', content: reply },
        ]);
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      } else if (intent === 'activity') {
        const { entries } = await authedFetch('/api/parse-activity', { activityText: trimmed });
        const summary = (entries || [])
          .map((e: any) => `${e.activity_type} — ${e.duration_min} min, ${e.kcal_burned} kcal burned`)
          .join('; ');
        const reply = `Logged: ${summary}.`;
        await logChatTurns([
          { role: 'user', content: trimmed },
          { role: 'assistant', content: reply },
        ]);
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      } else {
        const conversationHistory = priorMessages.map((m) => ({ role: m.role, content: m.content }));
        const { reply } = await authedFetch('/api/ask-unflump', { message: trimmed, conversationHistory });
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      }
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
            <ChatBubble key={i} role={m.role}>
              {m.content}
            </ChatBubble>
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
