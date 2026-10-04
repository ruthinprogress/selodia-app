import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';

import { Checkbox } from '@/components/checkbox';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ButtonRadius, CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  TRAINING_EXPLANATION,
  focusFromMode,
  modeExplanation,
  modeFromFocus,
  modeLabel,
  trainingToggleLabel,
  type BodyMode,
} from '@/lib/body-mode';
import { supabase } from '@/lib/supabase';

// HOW SHE IS EATING THIS WEEK, ON THE SCREEN SHE OPENS EVERY DAY (4 October 2026).
//
// Ruth, about the training switch buried in her profile: "This is lovely, if it
// works, but useless hidden away in profile settings. Please move it to the Today
// page as a toggle." And then the larger idea, which is the right one:
//
//   "What if this all lives on today and can be easily switched on and off by
//   the user as weeks pass by and life happens... Two Toggles on the Today
//   screen, each with a hideable explanation."
//
// THREE SWITCHES, AND THEY ARE NOT THE SAME KIND OF THING.
//   Lose fat, Build muscle - TARGETS. What she is asking her body to do.
//   Training paused        - A FACT ABOUT HER LIFE. Not a target, and the one
//                            thing here the app has no way to infer.
// They sit together because they all change the same two figures, and they are
// worded apart because confusing a target with a circumstance is how somebody
// ends up feeling they have failed at a fortnight in Spain.
//
// CHECKBOXES, NOT SWITCHES, and the training one a button. There is no Switch
// anywhere in this app - see macro-choices.tsx, which reasons it out - and the
// control she has already met for an on/off answer is the Checkbox. The training
// row is a button instead because its heading is the ACTION, which is what she
// asked for: "Pause Training/Restart Training (whichever one is not selected)".
//
// THE EXPLANATION IS HIDDEN UNTIL ASKED FOR. Her instruction: "user can keep that
// hidden most of the time as they only really need the explanation occasionally."
// Collapsed, this is one quiet line naming where she is.

export function BodyModes() {
  const theme = useTheme();
  const [mode, setMode] = useState<BodyMode | null>(null);
  const [paused, setPaused] = useState(false);
  const [open, setOpen] = useState(false);
  const [explaining, setExplaining] = useState<'mode' | 'training' | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('user_profile')
        .select('fat_focus_state, muscle_focus_state, training_state')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const p = data as {
        fat_focus_state?: string | null;
        muscle_focus_state?: string | null;
        training_state?: string | null;
      } | null;
      setMode(modeFromFocus(p?.fat_focus_state as never, p?.muscle_focus_state as never));
      setPaused(p?.training_state === 'paused');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(load);

  /**
   * ONE WRITE, BOTH COLUMNS, ALWAYS. focusFromMode is the only thing that writes
   * these two, so the pair can never be half-set - which is the state that reads
   * as "not answered" everywhere else and would wipe her calorie target.
   */
  async function setBodyMode(next: BodyMode) {
    if (saving) return;
    const previous = mode;
    setMode(next);
    setSaving(true);
    setFailed(false);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setMode(previous);
      setSaving(false);
      setFailed(true);
      return;
    }
    const { fat, muscle } = focusFromMode(next);
    const { error } = await supabase
      .from('user_profile')
      .update({ fat_focus_state: fat, muscle_focus_state: muscle })
      .eq('user_id', user.id);
    setSaving(false);
    if (error) {
      setMode(previous);
      setFailed(true);
    }
  }

  async function setTraining(nextPaused: boolean) {
    if (saving) return;
    const previous = paused;
    setPaused(nextPaused);
    setSaving(true);
    setFailed(false);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setPaused(previous);
      setSaving(false);
      setFailed(true);
      return;
    }
    const { error } = await supabase
      .from('user_profile')
      .update({
        training_state: nextPaused ? 'paused' : 'training',
        training_state_set_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);
    setSaving(false);
    if (error) {
      setPaused(previous);
      setFailed(true);
    }
  }

  const current = mode ?? { loseFat: false, buildMuscle: false };
  // The shut line: where she is, and whether training is on. Nothing else.
  const summary = [modeLabel(mode), paused ? 'training paused' : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`How you are eating: ${summary}`}
        accessibilityHint={open ? 'Hides the settings' : 'Shows the settings'}
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.headLabel}>
          {summary}
        </ThemedText>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={theme.textSecondary}
        />
      </Pressable>

      {open && (
        <View style={styles.body}>
          <Checkbox
            checked={current.loseFat}
            onToggle={() => void setBodyMode({ ...current, loseFat: !current.loseFat })}
            label="Lose fat"
          />
          <Checkbox
            checked={current.buildMuscle}
            onToggle={() => void setBodyMode({ ...current, buildMuscle: !current.buildMuscle })}
            label="Build muscle"
          />

          {/* ONE EXPLANATION FOR THE PAIR, NOT ONE EACH. Both on is not the two
              explanations stacked - as independent switches that would imply a
              deficit AND a surplus, which is incoherent. See modeExplanation. */}
          <Disclosure
            label="What this does"
            open={explaining === 'mode'}
            onToggle={() => setExplaining((e) => (e === 'mode' ? null : 'mode'))}
            text={modeExplanation(mode)}
          />

          <View style={[styles.rule, { backgroundColor: theme.background }]} />

          <View style={styles.trainingRow}>
            <Pressable
              onPress={() => void setTraining(!paused)}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={trainingToggleLabel(paused)}
              accessibilityState={{ disabled: saving }}
              style={({ pressed }) => [
                styles.action,
                { borderColor: theme.textSecondary },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="small">{trainingToggleLabel(paused)}</ThemedText>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary" style={styles.trainingState}>
              {paused ? 'Paused at the moment' : 'Training at the moment'}
            </ThemedText>
          </View>

          <Disclosure
            label="What this does"
            open={explaining === 'training'}
            onToggle={() => setExplaining((e) => (e === 'training' ? null : 'training'))}
            text={TRAINING_EXPLANATION}
          />

          {failed && (
            <ThemedText type="small" themeColor="danger">
              That didn&apos;t save. Check your connection and try again.
            </ThemedText>
          )}
        </View>
      )}
    </ThemedView>
  );
}

function Disclosure({
  label,
  open,
  onToggle,
  text,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  text: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.disclosure}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={label}
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.disclosureHead, pressed && styles.pressed]}>
        <ThemedText type="small" themeColor="accentDeep">
          {label}
        </ThemedText>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={12}
          color={theme.accentDeep}
        />
      </Pressable>
      {open && (
        <ThemedText type="small" themeColor="textSecondary">
          {text}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: CardRadius, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headLabel: { flexGrow: 1 },
  body: { gap: Spacing.three, paddingTop: Spacing.three },
  rule: { height: 1 },
  trainingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, flexWrap: 'wrap' },
  // ButtonRadius on a short control is a pill, which is what it should be. It
  // was 999 on a TALL card that gave Ruth "some strange blobs" on 2 October; the
  // radius was never the fault, the height of what it sat on was.
  action: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: ButtonRadius,
    borderWidth: 1,
  },
  trainingState: { flexShrink: 1 },
  disclosure: { gap: Spacing.one },
  disclosureHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  pressed: { opacity: 0.6 },
});
