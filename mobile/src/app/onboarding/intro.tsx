import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatBubble } from '@/components/chat-bubble';
import { ChatLandingChips } from '@/components/chat-landing-chips';
import { useOnboardingAction } from '@/components/onboarding-action';
import { ConversationLayout } from '@/components/conversation-layout';
import { ResourceCard } from '@/components/resource-card';
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

// Part Seven, step 3: the soft, warm open. The greeting is fixed client-side; the
// real acknowledgement is AI-driven via the 'intro' phase, which — unlike the old
// scripted shell — runs the shared safety classifier, so an emotionally open
// first answer gets the same care-first branch the goals step has, instead of a
// canned line.
//
// REWRITTEN 2026-09-01 after device testing: the old opener was "Hi, I'm Selodia.
// What brings you here today?" and it left people stranded. Two faults. The
// question was wide open with nothing to push against, so someone who had just
// arrived had to invent the shape of the conversation themselves — one tester had
// to prompt it to carry on at all. And it introduced the app by name, which reads
// as a product greeting rather than a person: they have just installed this and
// tapped its icon, so they know where they are.
//
// The replacement does the opposite of asking a big question — it offers a few
// small ones, as chips, and lets the first move be a tap.
const OPENING_LINE = 'Good to have you here. Here are a few places we could start:';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export default function IntroScreen() {
  // Destructured here rather than read as chatScroll.ref inside the JSX:
  // with the React Compiler on, a property access on the returned object
  // during render trips react-hooks/refs, which cannot tell it apart from
  // reading .current. Passing a ref BINDING to ref= is the sanctioned shape.
  const { ref: scrollRef, onContentSizeChange: onThreadGrew } = useChatScroll();
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typedSomething, setTypedSomething] = useState(false);
  const showChips = messages.length === 0 && !sending && !typedSomething;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) advanceOnboardingStep(supabase, user.id, 'intro');
    });
  }, []);

  // `override` lets a chip send its own words without routing them through the
  // input field. Same shape as the Chat screen's handleSend, deliberately — a
  // chip tap is a shortcut past typing, not a different kind of message, and
  // nothing downstream can tell the difference.
  async function handleSend(override?: string) {
    const trimmed = (override ?? input).trim();
    if (!trimmed || sending) return;
    if (override === undefined) setInput('');
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
        body: JSON.stringify({ message: trimmed, phase: 'intro' }),
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
      console.error('Intro chat send failed:', err instanceof Error ? err.message : err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Something went wrong on my end. Mind trying that again?" },
      ]);
    } finally {
      setSending(false);
    }
  }

  // Continue lives in the header now, not above the message box - see
  // components/onboarding-action.tsx. The condition and the destination stay
  // here, where they belong; only the button moved.
  useOnboardingAction({
    label: 'Continue',
    enabled: messages.length > 0,
    onPress: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await advanceOnboardingStep(supabase, user.id, 'equipment');
      router.push('/onboarding/equipment');
    },
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

          {/* Beneath the greeting, inside the thread — these are four things the
              person could say, sitting where their reply will go. Shown only
              while nothing has been said and nothing typed, which is what "at
              the opening only" means here: no flag needed, because a thread with
              a message in it is self-evidently past its opening.

              Local state, unlike the post-onboarding Chat chips, which need a
              database column because they must not return on another device
              weeks later. These live for the length of one screen. */}
          {showChips && (
            <ChatLandingChips inline onPick={(text) => void handleSend(text)} />
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
            </ThemedView>
          ))}

          {sending && <ChatBubble role="assistant">…</ChatBubble>}
        </ScrollView>

        <ThemedView style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={(t) => {
              setInput(t);
              // Typing freely is its own answer to the offer.
              if (t.length > 0) setTypedSomething(true);
            }}
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
