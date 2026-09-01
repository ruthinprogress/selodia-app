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

type DeferredTopic = { topic?: string; at?: string };

// Step 11 (UNFLUMP_SPEC.md, Part Seven): a typical week of movement → activity
// level → a TDEE estimate the route states deterministically. This is the final
// content step, so it owns the onboarding finish. phaseComplete marks the
// confirmation turn; on it we also resurface anything the person deferred earlier
// this session (the spec's topic-and-timestamp marker, checked before the session
// naturally wraps) so a "let's come back to that later" is honoured, not dropped.
const OPENING_LINE =
  "Last thing for now — I'd love a feel for how you move in a typical week. Nothing structured, just what your days actually look like. What does a normal week look like for you?";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

// Deterministic, warm resurfacing copy built client-side from the person's own
// deferred phrasing — no model turn, matching the code-built-statement principle.
function buildDeferralResurface(topics: DeferredTopic[]): string | null {
  const phrases = topics
    .map((t) => (typeof t.topic === 'string' ? t.topic.trim() : ''))
    .filter((t) => t.length > 0);
  if (phrases.length === 0) return null;
  if (phrases.length === 1) {
    return `Before we finish — earlier you mentioned ${phrases[0]}. I've kept a note of it, and we can pick that up together whenever the time feels right.`;
  }
  const list =
    phrases.slice(0, -1).join(', ') + ` and ${phrases[phrases.length - 1]}`;
  return `Before we finish — earlier you mentioned a few things you'd like to get to: ${list}. I've kept a note of them, and we can come back to them whenever you're ready.`;
}

export default function ActivityScreen() {
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
  const [finishing, setFinishing] = useState(false);
  const [saveToast, setSaveToast] = useState<{ summary: string; nonce: number } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) advanceOnboardingStep(supabase, user.id, 'activity_tdee');
    });
  }, []);

  // Reads the marker the route persisted (user_profile.deferred_topics) and, if
  // anything is waiting, appends a closing bubble that acknowledges it.
  async function maybeResurfaceDeferrals() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase
      .from('user_profile')
      .select('deferred_topics')
      .eq('user_id', user.id)
      .maybeSingle();
    const topics: DeferredTopic[] = Array.isArray(prof?.deferred_topics) ? prof.deferred_topics : [];
    const line = buildDeferralResurface(topics);
    if (line) setMessages((prev) => [...prev, { role: 'assistant', content: line }]);
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
        body: JSON.stringify({ message: trimmed, phase: 'activity_tdee' }),
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
      // Resurface deferrals once, on the turn the step completes — before Finish.
      if (data.phaseComplete && !phaseComplete) {
        setPhaseComplete(true);
        await maybeResurfaceDeferrals();
      }
    } catch (err) {
      console.error('Activity chat send failed:', err instanceof Error ? err.message : err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Something went wrong on my end — mind trying that again?" },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function handleFinish() {
    if (finishing) return;
    setFinishing(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await advanceOnboardingStep(supabase, user.id, 'complete');
    router.replace('/');
  }

  // The last step, so the label is Finish rather than Continue - the context
  // carries the word precisely so the header does not have to know which screen
  // is the last one.
  useOnboardingAction({
    label: finishing ? 'Finishing…' : 'Finish',
    enabled: phaseComplete && !finishing,
    onPress: handleFinish,
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
