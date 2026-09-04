import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatBubble } from '@/components/chat-bubble';
import { ComposerAddSheet } from '@/components/composer-add-sheet';
import { VoiceControl } from '@/components/voice-control';
import { ConversationLayout } from '@/components/conversation-layout';
import { CycleDiscoveryCard } from '@/components/cycle-discovery-card';
import { FoodBreakdownTable } from '@/components/food-breakdown-table';
import { HealthDisclaimer } from '@/components/health-disclaimer';
import { ReminderOffer } from '@/components/reminder-offer';
import { ResourceCard } from '@/components/resource-card';
import { ChatLandingChips } from '@/components/chat-landing-chips';
import { RotatingPlaceholder } from '@/components/rotating-placeholder';
import { SaveConfirmation } from '@/components/save-confirmation';
import { useSpotlight } from '@/components/spotlight-provider';
import { SpotlightTarget } from '@/components/spotlight-target';
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
import { hasSeenChatChips, markChatChipsSeen } from '@/lib/chat-chips';
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
const FALLBACK_ERROR = "Something went wrong on my end. Mind trying that again?";
const NOT_SIGNED_IN_ERROR = "You're not signed in. Please sign in and try again.";

// Same thread, message for message? Compared on the fields that are actually
// rendered, so a re-signed image URL - which changes on every fetch - does not
// register as a change and scroll the view.
function sameThread(a: Message[], b: Message[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].role !== b[i].role) return false;
    if (a[i].content !== b[i].content) return false;
    if ((a[i].imagePath ?? null) !== (b[i].imagePath ?? null)) return false;
    if ((a[i].foodLogId ?? null) !== (b[i].foodLogId ?? null)) return false;
  }
  return true;
}

export default function ChatScreen() {
  const router = useRouter();
  // Destructured here rather than read as chatScroll.ref inside the JSX:
  // with the React Compiler on, a property access on the returned object
  // during render trips react-hooks/refs, which cannot tell it apart from
  // reading .current. Passing a ref BINDING to ref= is the sanctioned shape.
  const { ref: scrollRef, onContentSizeChange: onThreadGrew } = useChatScroll();
  const theme = useTheme();
  const spotlight = useSpotlight();
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
  // Once the composer has been touched the hint stops cycling, and stays
  // stopped for the session. Resuming on blur would be the same interruption a
  // second time.
  const [hintStopped, setHintStopped] = useState(false);
  // The first-time landing chips. Null while the checks are still running, so
  // nothing flashes on screen before it is known whether it belongs there.
  const [showChips, setShowChips] = useState<boolean | null>(null);

  // Live values for the focus guard below, held in refs so the effect does not
  // re-subscribe on every keystroke. Written in effects, read only inside
  // callbacks - never during render.
  const sendingRef = useRef(false);
  const inputRef = useRef('');
  useEffect(() => {
    sendingRef.current = sending;
  }, [sending]);
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  const loadThread = useCallback(async () => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('role, content, image_path, food_log_id')
      .eq('source', 'chat')
      .order('created_at', { ascending: true });
    if (error || !data) return;

    const rows: Message[] = data.map((m) => ({
      role: m.role,
      content: m.content,
      imagePath: m.image_path ?? null,
      foodLogId: m.food_log_id ?? null,
    }));
    // One batched signing call for the whole thread rather than one per
    // message. A path that fails to sign just renders without its image, so a
    // broken object can never cost the person their history.
    const urls = await signCardImageUrls(
      rows.map((r) => r.imagePath).filter((v): v is string => typeof v === 'string')
    );
    const next = attachImageUrls(rows, urls);

    // Returns the PREVIOUS array unchanged when nothing moved. React then bails
    // out of the re-render, which is the whole reason the scroll stays put: a
    // new array of equivalent objects still re-renders, still fires
    // onContentSizeChange, and that is what jumps the view to the bottom.
    setMessages((prev) => (sameThread(prev, next) ? prev : next));
  }, []);

  useEffect(() => {
    (async () => {
      await loadThread();
      setLoadingHistory(false);
    })();
  }, [loadThread]);

  // RE-READ THE THREAD WHENEVER CHAT COMES INTO VIEW.
  //
  // The Chat tab stays mounted in the tab navigator, so the mount-only load
  // above ran once at app start and never again. Anything logged from the Food
  // or Activity QuickLogBar wrote both turns correctly, with source 'chat', and
  // then sat invisible until the app was restarted. The data was never lost;
  // this screen simply never asked for it a second time.
  //
  // THREE THINGS IT MUST NOT DO, and each is guarded rather than hoped for:
  //
  //   1. Clobber an in-flight message. While `sending` is true the reply has
  //      not been written yet, and refetching would replace the optimistic user
  //      turn with a thread that does not contain it - the message would vanish
  //      from under them mid-send.
  //   2. Interrupt someone mid-sentence. Text in the composer means they are
  //      using this screen right now, and a thread that reshuffles under a
  //      half-typed message is worse than one that is briefly stale.
  //   3. Jump the scroll. Handled in loadThread by returning the previous state
  //      when nothing changed, which is the common case by far.
  useFocusEffect(
    useCallback(() => {
      if (sendingRef.current) return;
      if (inputRef.current.trim().length > 0) return;
      void loadThread();
    }, [loadThread])
  );

  // WHETHER THE LANDING CHIPS BELONG ON SCREEN, re-checked every time Chat comes
  // into focus.
  //
  // This used to ride along inside the history effect above, which runs once on
  // mount with an empty dependency list — and the Chat tab STAYS MOUNTED in the
  // tab navigator. So the answer was decided at whatever moment Chat first
  // mounted, which can be before onboarding has finished, and was never revisited.
  // That is what made the chips turn up at the end of onboarding rather than on a
  // genuine first landing: the decision had been taken minutes earlier, against a
  // different state, and nothing re-asked it. Found on device 2026-09-01.
  //
  // THREE conditions, all necessary:
  //   1. Onboarding is COMPLETE. The chips are an on-ramp into ordinary use, and
  //      someone still being set up has not arrived yet. This is the condition
  //      that was missing entirely.
  //   2. The post-onboarding thread is EMPTY. Onboarding turns are stored with
  //      source 'onboarding' and Chat reads only source 'chat', so they already
  //      do not count — but this also keeps the chips off an established
  //      conversation, which matters because every existing account has a null
  //      stamp and would otherwise see them once.
  //   3. They have not been used before.
  //
  // Fails closed in every direction: any error, and the chips do not appear.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [{ data: profile }, { count }] = await Promise.all([
            supabase.from('user_profile').select('onboarding_step').maybeSingle(),
            supabase
              .from('chat_messages')
              .select('*', { count: 'exact', head: true })
              .eq('source', 'chat'),
          ]);
          const complete = profile?.onboarding_step === 'complete';
          const emptyThread = (count ?? 0) === 0;
          const show = complete && emptyThread && !(await hasSeenChatChips());
          if (!cancelled) setShowChips(show);
        } catch {
          if (!cancelled) setShowChips(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

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

  // `override` lets a landing chip send its own words without them having to be
  // routed through the input field first. Optional rather than required so every
  // existing caller is unchanged - but note the Send button now calls this
  // through an arrow, because passing handleSend directly to onPress would hand
  // it a press event as the override.
  // Dismissal is one path whatever triggered it, so a tap and a keystroke can
  // never leave the chips in different states. Stamped on FIRST INTERACTION
  // rather than on first sight: someone who lands, reads and leaves without
  // touching anything has not been on-ramped, and deserves the offer again.
  function dismissChips() {
    if (!showChips) return;
    setShowChips(false);
    void markChatChipsSeen();
  }

  function handleChipPick(text: string) {
    dismissChips();
    void handleSend(text);
  }

  async function handleSend(override?: string) {
    const trimmed = (override ?? input).trim();
    if (!trimmed || sending) return;
    // Only clear the field when the field is what was sent. A chip tap must not
    // wipe something half-typed - though in practice typing has already
    // dismissed the chips by then.
    if (override === undefined) setInput('');
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
      const { reply, resourceCard, healthGuidanceApplied, saved, foodLogId, navigationTarget } =
        await authedFetch('/api/ask-unflump', {
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

      // The spotlight (build item 23). Requested AFTER the reply is on screen,
      // never instead of it: the words answer the question on their own, and the
      // highlight is the extra. If the target is on another tab nothing appears
      // now - the request waits, and highlights if the person goes there.
      if (navigationTarget) spotlight?.show(navigationTarget, reply);

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
        {/* The one pointable step that actually crosses a screen (item 23):
            "where do I get my data" pulses this link, the tap opens Settings,
            and the export highlights on arrival. Every other cross-screen route
            in the app runs through a tab icon, which cannot be pointed at. */}
        <SpotlightTarget id="chat.settings" onActivate={() => router.push('/settings')}>
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
        </SpotlightTarget>

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

        {/* Above the input row and outside the ScrollView, deliberately. Inline
            among the bubbles they would read as something Selodia had said, and
            they are not - they are the person's own opening lines, waiting to be
            chosen. Sitting directly over the message box makes the relationship
            obvious: these are things you could type, already typed. */}
        {showChips === true && <ChatLandingChips onPick={handleChipPick} />}

        <ThemedView style={styles.inputRow}>
          <SpotlightTarget id="chat.add" onActivate={() => setAddOpen(true)}>
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
          </SpotlightTarget>
          {/* No onActivate: there is nothing to "press" on a text field, and
              stealing focus behind a closing overlay would put a keyboard up
              that nobody asked for. Dismissing leaves it there to tap. */}
          <SpotlightTarget id="chat.composer" style={styles.composerTarget}>
            <TextInput
              value={input}
              onChangeText={(t) => {
                setInput(t);
                // Typing freely is itself an answer to the offer, so the chips
                // get out of the way on the first character rather than waiting
                // for the message to be sent.
                if (t.length > 0) dismissChips();
              }}
              // The visible hint is RotatingPlaceholder, laid over this input:
              // a native placeholder cannot be faded, so there is nothing to
              // animate on it. Empty here, and an accessibilityLabel instead so
              // the field still announces itself while the hint above it is
              // hidden from screen readers.
              placeholder=""
              accessibilityLabel="Message"
              onFocus={() => setHintStopped(true)}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              multiline
              editable={!sending}
            />
            {/* Only while there is nothing typed. A hint under real text would
                be two overlapping lines. */}
            {input.length === 0 ? <RotatingPlaceholder stopped={hintStopped} /> : null}
          </SpotlightTarget>
          {/* Between the input and Send, which is where Claude and ChatGPT
              both put it (Part Eighteen: "same position as Claude and
              ChatGPT"). Send stays rightmost because it is the destructive-ish
              one to hit by accident - it commits text - and moving a control
              somebody already has muscle memory for is a cost with no benefit.

              Renders nothing on web; see voice-control.web.tsx. */}
          <VoiceControl
            onNotice={(message) => setSaveToast({ summary: message, nonce: Date.now() })}
            disabled={sending}
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
  // The wrapper takes the flex the input used to, so wrapping it does not
  // collapse the composer to its content width.
  composerTarget: { flex: 1 },
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
