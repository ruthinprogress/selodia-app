import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatBubble } from '@/components/chat-bubble';
import { ComposerAddSheet } from '@/components/composer-add-sheet';
import { ConversationLayout } from '@/components/conversation-layout';
import { CycleDiscoveryCard } from '@/components/cycle-discovery-card';
import { FoodBreakdownTable } from '@/components/food-breakdown-table';
import { HealthDisclaimer } from '@/components/health-disclaimer';
import { ReminderOffer } from '@/components/reminder-offer';
import { ResourceCard } from '@/components/resource-card';
import { SaveConfirmation } from '@/components/save-confirmation';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useChatScroll } from '@/hooks/use-chat-scroll';
import { useTheme } from '@/hooks/use-theme';
import { attachImageUrls, signCardImageUrls } from '@/lib/chat-images';
import type { AddSource } from '@/lib/composer-add';
import { classifyAndLog, messageForResult, pickImage } from '@/lib/image-logging';
import { loadLatestInterpretation } from '@/lib/log-acknowledgment-facts';
import { shouldShowDiscoveryPrompt } from '@/lib/cycle';
import { shouldOfferReminders } from '@/lib/reminder-settings';
import { supabase } from '@/lib/supabase';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  resourceCard?: { title: string; description: string; url: string } | null;
  healthGuidanceApplied?: boolean;
  // The food entry this turn logged, when it logged one. The turn carries only
  // the REFERENCE; the table itself is read from food_items at render time, so
  // it always shows what was stored rather than what the reply said.
  foodLogId?: string | null;
  // A discuss-card image posted into the thread (build item 30). imagePath is
  // the stored object; imageUri is its short-lived signed URL, since the bucket
  // is private. Only history carries these today — the "Ask about this" button
  // that creates them lands with slice 4, alongside the capture that makes an
  // image to post in the first place.
  imagePath?: string | null;
  imageUri?: string | null;
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const FALLBACK_ERROR = "Something went wrong on my end — mind trying that again?";
const NOT_SIGNED_IN_ERROR = "You're not signed in — please sign in and try again.";

export default function ChatScreen() {
  const router = useRouter();
  // Destructured here rather than read as chatScroll.ref inside the JSX:
  // with the React Compiler on, a property access on the returned object
  // during render trips react-hooks/refs, which cannot tell it apart from
  // reading .current. Passing a ref BINDING to ref= is the sanctioned shape.
  const { ref: scrollRef, onContentSizeChange: onThreadGrew } = useChatScroll();
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  // The Almanac's "Update this" hands the entry over with the opening line
  // already written, so editing stays conversational without the person having
  // to retype what they are referring to (Part Ten, Editing). Applied once, and
  // never over something already typed.
  // Adjusted during render rather than in an effect: the Chat tab stays mounted
  // in the tab navigator, so a lazy useState initialiser would never see a
  // prefill arriving later, and setState-in-effect is both disallowed and an
  // extra render. This is React's sanctioned shape for reacting to a changed
  // prop. Never overwrites something already typed.
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const [lastPrefill, setLastPrefill] = useState<string | null>(null);
  if (typeof prefill === 'string' && prefill.length > 0 && prefill !== lastPrefill) {
    setLastPrefill(prefill);
    if (input.length === 0) setInput(prefill);
  }
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saveToast, setSaveToast] = useState<{ summary: string; nonce: number } | null>(null);
  const [cyclePrompt, setCyclePrompt] = useState<'discover' | 'relog' | null>(null);
  // Shown once, after a log has actually happened - never on open, and never
  // before there is a reason to want it (Part Fourteen).
  const [offerReminders, setOfferReminders] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('role, content, image_path, food_log_id')
        .eq('source', 'chat')
        .order('created_at', { ascending: true });

      if (!error && data) {
        const rows: Message[] = data.map((m) => ({
          role: m.role,
          content: m.content,
          imagePath: m.image_path ?? null,
          foodLogId: m.food_log_id ?? null,
        }));
        // One batched signing call for the whole thread rather than one per
        // message. A path that fails to sign just renders without its image,
        // so a broken object can never cost the person their history.
        const urls = await signCardImageUrls(
          rows.map((r) => r.imagePath).filter((v): v is string => typeof v === 'string')
        );
        setMessages(attachImageUrls(rows, urls));
      }
      setLoadingHistory(false);
    })();
  }, []);

  // Cycle-tracking discovery (Part Thirteen): a background check on the last
  // logged period start and any prior dismissal decides whether the invitation
  // surfaces. RLS scopes both reads to the signed-in user.
  useEffect(() => {
    (async () => {
      const { data: lastPeriod } = await supabase
        .from('cycle_events')
        .select('event_date')
        .eq('event_type', 'period_start')
        .order('event_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: profile } = await supabase
        .from('user_profile')
        .select('cycle_prompt_dismissed_at')
        .maybeSingle();
      if (
        shouldShowDiscoveryPrompt({
          lastPeriodStart: lastPeriod?.event_date ?? null,
          dismissedAt: profile?.cycle_prompt_dismissed_at ?? null,
        })
      ) {
        setCyclePrompt(lastPeriod?.event_date ? 'relog' : 'discover');
      }
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

  // Image logging (build item 10b). The sheet asks only WHERE the image comes
  // from; what it is gets classified afterwards, so the person is never made to
  // categorise their own photo.
  async function handleAdd(source: AddSource) {
    setAddOpen(false);
    if (picking) return;
    setPicking(true);
    try {
      const picked = await pickImage(source);
      if (!picked.ok) {
        const msg = messageForResult(
          picked.reason === 'denied'
            ? { status: 'denied', source }
            : picked.reason === 'too_large'
              ? { status: 'too_large' }
              : picked.reason === 'failed'
                ? { status: 'failed' }
                : { status: 'cancelled' }
        );
        if (msg) setMessages((m) => [...m, { role: 'assistant', content: msg }]);
        return;
      }

      const result = await classifyAndLog(picked.image);
      const msg = messageForResult(result);
      const foodLogId = result.status === 'logged' ? (result.foodLogId ?? null) : null;
      // A photographed meal earns the same itemised table as a typed one - it is
      // the same food_items data either way, and the photo path is the one where
      // seeing what was counted matters most, since nobody typed the items.
      if (msg || foodLogId) {
        setMessages((m) => [...m, { role: 'assistant', content: msg ?? '', foodLogId }]);
      }
      if (result.status === 'logged') {
        // Same brief confirmation the text path shows - never a written-out
        // receipt in the reply itself.
        setSaveToast({ summary: 'Saved from your photo', nonce: Date.now() });
        if (await shouldOfferReminders()) setOfferReminders(true);
      }
    } finally {
      setPicking(false);
    }
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
      const { reply, resourceCard, healthGuidanceApplied, saved, foodLogId } = await authedFetch('/api/ask-unflump', {
        message: trimmed,
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply, resourceCard, healthGuidanceApplied, foodLogId },
      ]);
      if (saved?.summary) {
        setSaveToast((prev) => ({ summary: saved.summary, nonce: (prev?.nonce ?? 0) + 1 }));
        if (await shouldOfferReminders()) setOfferReminders(true);
      }

      // A weight logged by TEXT surfaced nothing but a toast, while the same
      // weight photographed came back with the interpretation layer's reading
      // of it. That asymmetry had no reason behind it - the person typed the
      // number, so they already know it; what they do not know is what it
      // means, which is the whole point of the layer.
      //
      // Only the interpretation, deliberately: no facts block and no second
      // model call. The photo path needs a facts block because a photo has no
      // words attached; a typed message already has the person's own.
      if (saved?.kind === 'measurement') {
        try {
          const note = await loadLatestInterpretation();
          // Null is a real answer - a clean drop, or too little history to say
          // anything honest. Nothing is shown rather than filler.
          if (note) setMessages((prev) => [...prev, { role: 'assistant', content: note }]);
        } catch (err) {
          // The reading is already saved; failing to explain it must not read
          // as a failure to log it.
          console.error('Interpretation failed:', err instanceof Error ? err.message : err);
        }
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
    <ConversationLayout>
      <SafeAreaView style={styles.safeArea}>
        {/* The single entry to account settings (build item 41). On Chat because
            it is the home screen and the one surface everyone lands on; not a
            fourth tab, because Part Five keeps the app to three destinations;
            and not in the Almanac, which Part Ten sets aside from standard
            account items. Quiet and top-aligned so it never competes with the
            conversation. */}
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Account settings"
          style={({ pressed }) => [styles.settingsEntry, pressed && styles.settingsPressed]}
        >
          <ThemedText type="small" themeColor="textSecondary">
            Settings
          </ThemedText>
        </Pressable>

        <ScrollView
          ref={scrollRef}
          onContentSizeChange={onThreadGrew}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {cyclePrompt && (
            <CycleDiscoveryCard mode={cyclePrompt} onDone={() => setCyclePrompt(null)} />
          )}

          {!loadingHistory && messages.length === 0 && (
            <ChatBubble role="assistant">
              What did you eat, what did you do, or what&apos;s on your mind?
            </ChatBubble>
          )}

          {messages.map((m, i) => (
            <ThemedView key={i} style={styles.messageGroup}>
              {/* A turn can now carry a table and no words - a photo log whose
                  acknowledgment came back empty. Rendering the bubble anyway
                  would put an empty coloured box above the table. */}
              {(m.content.length > 0 || m.imageUri) && (
                <ChatBubble role={m.role} imageUri={m.imageUri}>
                  {m.content}
                </ChatBubble>
              )}
              {m.foodLogId && <FoodBreakdownTable foodLogId={m.foodLogId} />}
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

          {offerReminders && <ReminderOffer onDone={() => setOfferReminders(false)} />}
        </ScrollView>

        <ThemedView style={styles.inputRow}>
          <Pressable
            onPress={() => setAddOpen(true)}
            disabled={picking || sending}
            accessibilityRole="button"
            accessibilityLabel="Add a photo"
            hitSlop={Spacing.two}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedView
              type="backgroundElement"
              style={[styles.addButton, (picking || sending) && styles.addDisabled]}
            >
              <ThemedText type="smallBold">{picking ? '…' : '+'}</ThemedText>
            </ThemedView>
          </Pressable>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Talk to unflump…"
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
        <ComposerAddSheet
          visible={addOpen}
          onSelect={handleAdd}
          onCancel={() => setAddOpen(false)}
        />
      </SafeAreaView>
    </ConversationLayout>
  );
}

const styles = StyleSheet.create({
  // Deliberately understated: a text link, not a button or an icon badge. The
  // account surface should be findable without advertising itself above the
  // conversation the screen exists for.
  settingsEntry: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  settingsPressed: { opacity: 0.6 },
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
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDisabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
