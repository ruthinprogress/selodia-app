import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ChatBubble } from '@/components/chat-bubble';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authedPost } from '@/lib/api';

// A CONVERSATION THAT HAPPENS *INSIDE* SETUP.
//
// Ruth, 1 October 2026: "Setup should never send someone out of the flow. Any
// conversation should happen inside the setup screen itself (e.g. a chat panel
// on that screen), with the user returning to the next step when done."
//
// WHAT IT REPLACES, and it was worse than a detour. Three screens - medication,
// steer-around and allergies - answered a tap with `router.push('/')`, which
// leaves setup for the Chat tab. There was nothing to bring anybody back: the
// `fromOnboarding: '1'` flag on that push was read by no code anywhere.
//
// AND A NEW USER DID NOT EVEN ARRIVE. use-auth-guard sends an unfinished account
// that lands in the tabs to RESUME_ROUTE[step] - so a brand-new person tapping
// "yes, a few things" was bounced to an OLDER setup screen, with the question
// she was about to answer thrown away. The fix for that is in onboarding-step.ts;
// this is the fix for the detour itself.
//
// IT IS THE SAME PIPELINE, NOT A SIMPLER ONE. It posts to /api/ask-selodia, the
// route chat uses, so the safety classification, the allergy gate, the save
// offers and the confirm-first rule all apply exactly as they do anywhere else.
// A second, gentler conversational path through setup would be a second place
// for a distress turn to be handled differently, and that is not a thing to have
// two of.
//
// NOTHING HERE DECIDES WHAT IS SAVED. The panel sends words and renders the
// reply. Whether a medication list becomes a Me card is decided by the server,
// offered to her, and written only on her yes - see the `me` save type in
// pending-save.ts. The panel cannot write to her record and does not know how.
//
// THE TRANSCRIPT IS NOT THE CHAT TAB'S. These turns are posted through the same
// route, so they land in her chat history and she can scroll back to them later,
// which is right - she said them. What this panel shows is only the part of the
// exchange that happened here, so the setup screen does not become a window onto
// a conversation from last Tuesday.

export type SetupChatPanelProps = {
  /** The opening line, already in the box, for her to finish. Never auto-sent. */
  prefill?: string;
  /** What the empty box says before she types. */
  placeholder: string;
  /** The label on the button that leaves the panel and moves the flow on. */
  doneLabel: string;
  /** Called when she is finished here. The screen decides where that goes. */
  onDone: () => void;
  /** Shown above the transcript: what this conversation is for. */
  intro: string;
};

type Turn = { role: 'assistant' | 'user'; text: string };

export function SetupChatPanel({
  prefill = '',
  placeholder,
  doneLabel,
  onDone,
  intro,
}: SetupChatPanelProps) {
  const theme = useTheme();
  const [draft, setDraft] = useState(prefill);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  async function send() {
    const message = draft.trim();
    if (!message || sending) return;
    setFailed(false);
    setSending(true);
    // HER WORDS GO UP IMMEDIATELY. A reply takes a few seconds and a box that
    // empties into nothing looks like a message that did not send.
    setTurns((t) => [...t, { role: 'user', text: message }]);
    setDraft('');
    try {
      const data = await authedPost<{ reply?: string }>('/api/ask-selodia', { message });
      const reply = typeof data?.reply === 'string' ? data.reply : '';
      setTurns((t) => [...t, { role: 'assistant', text: reply || 'I did not catch that.' }]);
    } catch {
      // SAID PLAINLY AND HER WORDS KEPT. The draft goes back in the box so a
      // failure costs her a tap rather than the sentence she just typed.
      setFailed(true);
      setTurns((t) => t.slice(0, -1));
      setDraft(message);
    } finally {
      setSending(false);
    }
  }

  const canSend = draft.trim().length > 0 && !sending;

  return (
    <ThemedView style={styles.panel}>
      <ThemedText type="small" themeColor="textSecondary">
        {intro}
      </ThemedText>

      {turns.length > 0 && (
        <ScrollView
          ref={scrollRef}
          style={styles.transcript}
          contentContainerStyle={styles.transcriptBody}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          // The page scrolls too; this keeps a long exchange from taking the
          // whole screen and burying the way out.
          nestedScrollEnabled>
          {turns.map((turn, i) => (
            <ChatBubble key={i} role={turn.role}>
              {turn.text}
            </ChatBubble>
          ))}
          {sending && (
            <View style={styles.thinking}>
              <ActivityIndicator size="small" color={theme.accentDeep} />
              <ThemedText type="small" themeColor="textSecondary">
                Reading that…
              </ThemedText>
            </View>
          )}
        </ScrollView>
      )}

      {failed && (
        <ThemedText type="small" themeColor="danger">
          That didn&apos;t send. Your words are still in the box — try again.
        </ThemedText>
      )}

      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={placeholder}
        multiline
        // NO onSubmitEditing. These answers run to several lines - a list of
        // medications, an account of an old injury - and a Return key that sends
        // mid-sentence would cut them off.
        style={[styles.field, { color: theme.text, borderColor: theme.backgroundSelected }]}
      />

      <View style={styles.actions}>
        <Pressable
          onPress={() => void send()}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send"
          accessibilityState={{ disabled: !canSend }}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView
            style={[
              styles.send,
              { backgroundColor: theme.accentDeep },
              !canSend && styles.sendOff,
            ]}>
            <ThemedText type="small" style={{ color: theme.background }}>
              {sending ? 'Sending…' : 'Send'}
            </ThemedText>
          </ThemedView>
        </Pressable>

        {/* THE WAY OUT IS ALWAYS ON SCREEN, from the first render, before she
            has said anything. That is the whole point of this component: the
            flow must never depend on finishing a conversation, or on a model
            saying the right thing to release her. */}
        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel={doneLabel}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="small" themeColor="accentDeep" style={styles.done}>
            {doneLabel}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  panel: { gap: Spacing.two },
  // Capped so a long exchange cannot push the Continue button off the screen,
  // which is the failure this whole component exists to prevent.
  transcript: { maxHeight: 280 },
  transcriptBody: { gap: Spacing.two, paddingVertical: Spacing.one },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  field: {
    borderWidth: 1,
    borderRadius: CardRadius,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    minHeight: 88,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  send: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 999,
  },
  sendOff: { opacity: 0.4 },
  done: { paddingVertical: Spacing.two },
  pressed: { opacity: 0.7 },
});
