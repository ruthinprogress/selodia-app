import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatBubble } from '@/components/chat-bubble';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useChatScroll } from '@/hooks/use-chat-scroll';
import { useTheme } from '@/hooks/use-theme';
import { advanceOnboardingStep } from '@/lib/onboarding-step';
import { supabase } from '@/lib/supabase';

// Status-based capture only - never a lab number. The app acts on what the
// person reports, never on a threshold it computes itself (UNFLUMP_SPEC.md,
// Part Twelve). Every field is optional; the whole step is skippable.
type MarkerStatus = 'normal' | 'elevated' | 'low' | 'borderline' | 'unsure';
type MarkerKey = 'ldl' | 'hdl' | 'cholesterol' | 'glucose' | 'ferritin' | 'thyroid';

const MARKERS: { key: MarkerKey; label: string }[] = [
  { key: 'ldl', label: 'LDL cholesterol' },
  { key: 'hdl', label: 'HDL cholesterol' },
  { key: 'cholesterol', label: 'Total cholesterol' },
  { key: 'glucose', label: 'Blood sugar / HbA1c' },
  { key: 'ferritin', label: 'Ferritin / iron' },
  { key: 'thyroid', label: 'Thyroid (TSH)' },
];

// User-facing labels map to the stored status enum.
const STATUS_OPTIONS: { label: string; value: MarkerStatus }[] = [
  { label: 'Normal', value: 'normal' },
  { label: 'High', value: 'elevated' },
  { label: 'Low', value: 'low' },
  { label: 'Borderline', value: 'borderline' },
  { label: 'Not sure', value: 'unsure' },
];

const CONDITIONS: { key: ConditionKey; label: string }[] = [
  { key: 'condition_pcos', label: 'PCOS' },
  { key: 'condition_ibs', label: 'IBS' },
  { key: 'condition_hypothyroid', label: 'Hypothyroidism' },
  { key: 'condition_t2d', label: 'Type 2 diabetes' },
];
type ConditionKey = 'condition_pcos' | 'condition_ibs' | 'condition_hypothyroid' | 'condition_t2d';

export default function HealthContextScreen() {
  // Destructured here rather than read as chatScroll.ref inside the JSX:
  // with the React Compiler on, a property access on the returned object
  // during render trips react-hooks/refs, which cannot tell it apart from
  // reading .current. Passing a ref BINDING to ref= is the sanctioned shape.
  const { ref: scrollRef, onContentSizeChange: onThreadGrew } = useChatScroll();
  const theme = useTheme();
  const [phase, setPhase] = useState<'intro' | 'capture'>('intro');
  const [markers, setMarkers] = useState<Partial<Record<MarkerKey, MarkerStatus>>>({});
  const [conditions, setConditions] = useState<Record<ConditionKey, boolean>>({
    condition_pcos: false,
    condition_ibs: false,
    condition_hypothyroid: false,
    condition_t2d: false,
  });
  const [otherText, setOtherText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) advanceOnboardingStep(supabase, user.id, 'health_context');
    });
  }, []);

  // Health context sits mid-flow now (Part Seven order: … → health_context →
  // technical → nutrition → activity → complete). Both exits move on to the
  // technical step; the onboarding finish lives at the activity step's wrap.
  async function goToTechnical() {
    router.push('/onboarding/technical');
  }

  // Skip writes nothing - no health context stored, no acknowledgment needed,
  // the disclaimer can never fire. Just move on.
  async function handleSkip() {
    if (saving) return;
    setSaving(true);
    await goToTechnical();
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      await goToTechnical();
      return;
    }
    const now = new Date().toISOString();
    await supabase.from('health_context').upsert({
      user_id: user.id,
      ldl_status: markers.ldl ?? null,
      hdl_status: markers.hdl ?? null,
      cholesterol_status: markers.cholesterol ?? null,
      glucose_status: markers.glucose ?? null,
      ferritin_status: markers.ferritin ?? null,
      thyroid_status: markers.thyroid ?? null,
      condition_pcos: conditions.condition_pcos,
      condition_ibs: conditions.condition_ibs,
      condition_hypothyroid: conditions.condition_hypothyroid,
      condition_t2d: conditions.condition_t2d,
      conditions_other: otherText.trim() || null,
      // Tapping through to capture and saving is the explicit acknowledgment,
      // captured specifically here (special-category data), not general consent.
      acknowledged_at: now,
      updated_at: now,
    });
    await goToTechnical();
  }

  return (
    // NO ConversationLayout, matching account.tsx - the same fix, now that it is
    // a confirmed fix rather than a hypothesis.
    //
    // Both screens share one fault: their inputs sit INSIDE the scroll area,
    // where the shell's KeyboardAvoidingView shrinks the viewport without moving
    // the scroll position, so a focused field below the new fold stays hidden.
    // Adding automaticallyAdjustKeyboardInsets on top (38881d6) did nothing,
    // because iOS derives that inset from the intersection of the keyboard and
    // the scroll view frames - and once the shell has padded the view clear, the
    // intersection is empty and the inset is zero. The two cancel rather than
    // combine. Removing the shell lets the scroll view own its own insets, which
    // is what iOS wants for a form.
    //
    // Verified on device for sign-in (9551b64) before being applied here. The two
    // were split deliberately so that test had a single variable.
    //
    // ConversationLayout still belongs on the eight screens that pin an input row
    // below a thread - it was built for exactly that and it works there.
    // ThemedView replaces it here for the background, which is all it otherwise
    // contributed.
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          ref={scrollRef}
          onContentSizeChange={onThreadGrew}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="on-drag"
        >
          <ChatBubble role="assistant">
            One more optional thing. If you know any health markers — cholesterol, blood sugar, iron,
            thyroid — or have a diagnosed condition, I can keep them in mind so my food suggestions
            protect what matters for you, rather than treating every food as interchangeable.
          </ChatBubble>
          <ChatBubble role="assistant">
            This is sensitive health information, kept private to your account and used only to shape
            what I suggest. It never replaces medical advice — anything that affects a medical marker
            is always worth confirming with your GP or dietitian. Totally fine to skip.
          </ChatBubble>

          {phase === 'capture' && (
            <>
              <ChatBubble role="assistant">
                Just tap whatever your results or GP have told you — skip anything you don&apos;t know.
              </ChatBubble>

              {MARKERS.map((m) => (
                <ThemedView key={m.key} style={styles.field}>
                  <ThemedText type="smallBold">{m.label}</ThemedText>
                  <ThemedView style={styles.chipRow}>
                    {STATUS_OPTIONS.map((opt) => (
                      <Chip
                        key={opt.value}
                        label={opt.label}
                        selected={markers[m.key] === opt.value}
                        onPress={() =>
                          setMarkers((prev) =>
                            prev[m.key] === opt.value
                              ? { ...prev, [m.key]: undefined }
                              : { ...prev, [m.key]: opt.value }
                          )
                        }
                      />
                    ))}
                  </ThemedView>
                </ThemedView>
              ))}

              <ThemedView style={styles.field}>
                <ThemedText type="smallBold">Diagnosed conditions</ThemedText>
                <ThemedView style={styles.chipRow}>
                  {CONDITIONS.map((c) => (
                    <Chip
                      key={c.key}
                      label={c.label}
                      selected={conditions[c.key]}
                      onPress={() => setConditions((prev) => ({ ...prev, [c.key]: !prev[c.key] }))}
                    />
                  ))}
                </ThemedView>
                <TextInput
                  value={otherText}
                  onChangeText={setOtherText}
                  placeholder="Anything else? (optional)"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                  multiline
                />
              </ThemedView>
            </>
          )}
        </ScrollView>

        <ThemedView style={styles.actionRow}>
          {phase === 'intro' ? (
            <>
              <ActionButton label="Skip for now" onPress={handleSkip} disabled={saving} muted />
              <ActionButton
                label="Yes, add this"
                onPress={() => setPhase('capture')}
                disabled={saving}
              />
            </>
          ) : (
            <>
              <ActionButton label="Skip" onPress={handleSkip} disabled={saving} muted />
              <ActionButton
                label={saving ? 'Saving…' : 'Save & continue'}
                onPress={handleSave}
                disabled={saving}
              />
            </>
          )}
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type={selected ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
        <ThemedText type="small">{label}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  muted,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  muted?: boolean;
}) {
  return (
    // flex:1 belongs on the PRESSABLE, not on the view inside it. The Pressable
    // is the flex child of actionRow, and it carried no style at all except when
    // pressed - so it sized to its content, while the ThemedView inside asked for
    // flex:1, which Yoga expands to flexBasis:0. Nothing was left to grow that
    // basis back, so the box collapsed, the label had no room to lay out and
    // vanished, and only paddingVertical kept a visible pill on screen. Two
    // blank pills, found on device 2026-09-01; the style dated from the original
    // Health Context build on 13 August, so it had been wrong the whole time.
    //
    // The working buttons elsewhere never hit this because they size themselves
    // instead of asking a parent to do it - see goals.tsx's continueButton, which
    // uses width:'100%' and no flex at all.
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.actionSlot, pressed && styles.pressed]}
    >
      <ThemedView type={muted ? 'backgroundElement' : 'backgroundSelected'} style={styles.actionButton}>
        <ThemedText type="smallBold">{label}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Was ConversationLayout's own wrapper until the keyboard fix.
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
    // Slack below the last field, so a focused input near the bottom has
    // somewhere to scroll TO once the keyboard has taken the lower half.
    paddingBottom: Spacing.six * 2,
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  input: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    maxHeight: 100,
    marginTop: Spacing.one,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  // The row splits evenly between the two buttons, and it is the Pressable that
  // does the splitting - see the note on ActionButton.
  actionSlot: {
    flex: 1,
  },
  actionButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
