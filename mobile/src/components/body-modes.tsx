import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BodyModeToggles } from '@/components/body-mode-toggles';
import { ButtonRadius, CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  NO_MODE,
  PAUSE_EXPLANATION,
  isEmpty,
  modeExplanation,
  modeFromRecord,
  modeLabel,
  modeSafetyDetail,
  modeSafetyLine,
  modeWrite,
  pauseToggleLabel,
  usesLine,
  type BodyMode,
} from '@/lib/body-mode';
import { supabase } from '@/lib/supabase';

// HOW SHE IS EATING, ON THE SCREEN SHE OPENS EVERY DAY (Ruth, 4 October 2026).
//
//   "This is lovely, if it works, but useless hidden away in profile settings.
//   Please move it to the Today page as a toggle... collapsed by default to ONE
//   quiet line (for example 'Maintaining · around 1,350 kcal') with Pause inline."
//
// HER DESIGN TEST, which every decision below is measured against: low friction,
// low overwhelm. One tap, quiet by default, never ask what the app already knows,
// describe and never promise or score.
//
// FOUR SWITCHES, ONE PAUSE. Lose fat, Maintain weight and Gain weight are one
// weight direction and only one can be on - the other two dim, with a line saying
// why, because a control that vanishes leaves her hunting for something that was
// there yesterday. Build muscle is independent.
//
// PAUSE IS NOT A SWITCH. It is a button whose label is the action, and it changes
// no toggle: everything goes to what her body uses, her choices stay exactly as
// they were, and Resume puts them back. It sits on the shut line because the
// whole point is that it is one tap from the screen she already has open.
//
// SEPARATE CONTROLS, FULL-SIZE TARGETS. Her instruction. The line and the Pause
// button are two Pressables, not one with a nested tap area, because a control
// inside a control is how you press the wrong thing on a phone.
//
// NOTHING IS WRITTEN BY OPENING THIS. It reads on focus and writes only when she
// moves something - the lesson from four setup screens that reported saves they
// had refused to do.

export function BodyModes({
  /**
   * Called after a switch or the Pause has been WRITTEN, not when it is tapped.
   *
   * RUTH, 5 OCTOBER 2026: "Toggles only show if you toggle, come out of the
   * screen and then go back in. They need to be instant so the user can see the
   * effect each one has on the calorie guide."
   *
   * The figures above this card - the calorie guide and the protein range - are
   * read by the panel that owns the screen, on focus. This card wrote straight to
   * the database and told nobody, so the only way to see what a switch had done
   * was to leave Today and come back. For a control whose entire purpose is to
   * show the effect of a choice, that is the effect hidden behind a round trip.
   *
   * AFTER THE WRITE, NOT ON THE TAP. A refresh fired on the tap would read the
   * row the write has not finished changing and redraw the old figure, which is
   * worse than not refreshing at all: it looks like the switch did nothing.
   */
  onChanged,
}: { onChanged?: () => void } = {}) {
  const theme = useTheme();
  const [mode, setMode] = useState<BodyMode | null>(null);
  const [paused, setPaused] = useState(false);
  const [tdee, setTdee] = useState<number | null>(null);
  // NULL UNTIL SHE HAS SAID. "When you are your activity level" is not a
  // sentence, and the old fallback made one - so an unanswered question read as
  // an answer. Null gets its own wording below.
  const [activityWord, setActivityWord] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [explaining, setExplaining] = useState<'mode' | 'pause' | 'safety' | null>(null);
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
        .select('body_mode, fat_focus_state, muscle_focus_state, paused_at, activity_level')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const p = data as {
        body_mode?: unknown;
        paused_at?: string | null;
        activity_level?: string | null;
      } | null;
      setMode(modeFromRecord(p?.body_mode));
      setPaused(Boolean(p?.paused_at));
      setActivityWord(p?.activity_level ? ACTIVITY_WORD[p.activity_level] ?? null : null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(load);

  // TDEE is read where it is already computed, rather than recomputed here - the
  // figure on this card and the figure on the Food row must be the same number
  // from the same place, which is the whole lesson of the two protein targets.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('body_measurements')
          .select('bmr')
          .eq('user_id', user.id)
          .not('bmr', 'is', null)
          .order('measured_at', { ascending: false })
          .limit(1);
        const { data: prof } = await supabase
          .from('user_profile')
          .select('activity_level')
          .eq('user_id', user.id)
          .maybeSingle();
        if (cancelled) return;
        const bmr = Number((data ?? [])[0]?.bmr) || null;
        const factor = FACTOR[(prof as { activity_level?: string } | null)?.activity_level ?? ''] ?? null;
        setTdee(bmr && factor ? Math.round(bmr * factor) : null);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  async function write(next: BodyMode | null, nextPaused: boolean) {
    if (saving) return;
    const wasMode = mode;
    const wasPaused = paused;
    setMode(next);
    setPaused(nextPaused);
    setSaving(true);
    setFailed(false);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setMode(wasMode);
      setPaused(wasPaused);
      setSaving(false);
      setFailed(true);
      return;
    }
    // ONE WRITE, THE RECORD AND ITS VIEWS TOGETHER. modeWrite is the only thing
    // that produces all three, so body_mode and the two focus columns cannot
    // drift apart - which is what dropped her Maintain tick before body_mode
    // existed.
    const { error } = await supabase
      .from('user_profile')
      .update({ ...modeWrite(next), paused_at: nextPaused ? new Date().toISOString() : null })
      .eq('user_id', user.id);
    setSaving(false);
    if (error) {
      setMode(wasMode);
      setPaused(wasPaused);
      setFailed(true);
      return;
    }
    // THE FIGURES ABOVE ARE NOW WRONG UNTIL SOMETHING RE-READS THEM.
    onChanged?.();
  }

  const current = mode ?? NO_MODE;
  const nothingChosen = isEmpty(mode);

  // THE SHUT LINE: where she is, and the figure, and nothing else. Capitalised
  // throughout - her note: "everything should start with a capital or it feels
  // broken".
  //
  // CAPITAL ON EVERY SEGMENT, which is her "Capital on Training" note generalised
  // rather than applied to the one word she happened to be looking at. In the
  // two-switch mock the shut line ended "... · training"; that segment is gone
  // with the training switch, but the fault she named was a segment after a
  // separator starting lowercase, and the figure had exactly the same fault.
  const figure =
    nothingChosen || tdee == null
      ? null
      : paused
        ? `Around ${tdee.toLocaleString('en-GB')} kcal`
        : null;
  const summary = [modeLabel(mode), paused ? 'Paused' : null, figure].filter(Boolean).join(' · ');

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {/* TWO CONTROLS, NOT ONE. Her instruction, and the reason is the thumb: a
          button nested inside a bigger pressable is how you open a panel when you
          meant to pause. */}
      <View style={styles.head}>
        <Pressable
          onPress={() => setOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={summary}
          accessibilityHint={open ? 'Hides your goal settings' : 'Shows your goal settings'}
          hitSlop={Spacing.two}
          style={({ pressed }) => [styles.headLine, pressed && styles.pressed]}>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {summary}
          </ThemedText>
        </Pressable>

        {!nothingChosen && (
          <Pressable
            onPress={() => void write(mode, !paused)}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={pauseToggleLabel(paused)}
            accessibilityState={{ disabled: saving }}
            hitSlop={Spacing.two}
            style={({ pressed }) => [
              styles.pause,
              { borderColor: theme.textSecondary },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="small">{pauseToggleLabel(paused)}</ThemedText>
          </Pressable>
        )}

        <Pressable
          onPress={() => setOpen((o) => !o)}
          accessibilityLabel={open ? 'Hide' : 'Show'}
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}>
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={theme.textSecondary}
          />
        </Pressable>
      </View>

      {open && (
        <View style={styles.body}>
          {/* THE BASE SENTENCE, AND IT IS NEVER CALLED A TARGET (her item 2).
              Maintenance is an observation about her body; a number she did not
              choose, called a target, starts reading as a test she can fail. */}
          {/* ONE TEXT NODE, NOT THREE IN A ROW (Ruth, 5 October 2026: "comma is
              on the following line, fix").

              It was three <ThemedText>s inside a wrapping flex row - "At ", the
              link, and ", your body uses around N kcal a day." A flex row wraps
              between its CHILDREN, so when the link was long the comma began the
              next line on its own, which is not a thing writing does.

              Nested text wraps as text: React Native lets a <Text> with an
              onPress sit inside another <Text>, and the whole thing lays out as
              one paragraph. The link keeps its colour, its underline and its tap
              target. */}
          {tdee != null && (
            <ThemedText type="small" themeColor="textSecondary">
              {activityWord ? 'When you are ' : 'Set '}
              <ThemedText
                type="small"
                themeColor="accentDeep"
                style={styles.link}
                // CAST AS THE REST OF THIS CODEBASE DOES. Expo Router generates
                // its route union at build time and has not seen this screen yet;
                // the file exists at app/settings/activity-level.tsx.
                onPress={() => router.push('/settings/activity-level' as never)}
                accessibilityRole="link"
                accessibilityLabel="How active are you?">
                {activityWord ?? 'how active your weeks are'}
              </ThemedText>
              {activityWord
                ? `, your body uses around ${tdee.toLocaleString('en-GB')} kcal a day.`
                : ` and this follows it. For now your body is read as using around ${tdee.toLocaleString(
                    'en-GB'
                  )} kcal a day.`}
            </ThemedText>
          )}

          {/* THE SAME FOUR SWITCHES AS SETUP, from the same component. They were
              four hand-written <Toggle> blocks here and about to be a fifth,
              sixth, seventh and eighth on the setup screen - see
              body-mode-toggles.tsx for why that is the shape to avoid. */}
          <BodyModeToggles
            mode={current}
            disabled={saving}
            onChange={(next) => void write(next, paused)}
          />

          <Disclosure
            label="What this does"
            open={explaining === 'mode'}
            onToggle={() => setExplaining((e) => (e === 'mode' ? null : 'mode'))}
            text={modeExplanation(mode)}
          />

          {/* SHOWN WHENEVER GAINING IS ON, and not behind the disclosure - one
              calm line stating a fact of medicine. The longer wording about
              recovery sits behind the "?" instead, because putting eating
              disorders in front of everybody who taps Gain weight would be the
              app deciding something about her it has no way to know. */}
          {modeSafetyLine(current) ? (
            <View style={styles.safetyRow}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.safetyText}>
                {modeSafetyLine(current)}
              </ThemedText>
              <Pressable
                onPress={() => setExplaining((e) => (e === 'safety' ? null : 'safety'))}
                accessibilityRole="button"
                accessibilityLabel="More about this"
                accessibilityState={{ expanded: explaining === 'safety' }}
                hitSlop={Spacing.two}
                style={({ pressed }) => [
                  styles.query,
                  { borderColor: theme.textSecondary },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="small" themeColor="textSecondary">
                  ?
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
          {explaining === 'safety' && modeSafetyDetail(current) ? (
            <ThemedText type="small" themeColor="textSecondary">
              {modeSafetyDetail(current)}
            </ThemedText>
          ) : null}

          <Disclosure
            label={paused ? 'What Resume does' : 'What Pause does'}
            open={explaining === 'pause'}
            onToggle={() => setExplaining((e) => (e === 'pause' ? null : 'pause'))}
            text={PAUSE_EXPLANATION}
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
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={theme.accentDeep} />
      </Pressable>
      {open && (
        <ThemedText type="small" themeColor="textSecondary">
          {text}
        </ThemedText>
      )}
    </View>
  );
}

/**
 * Each level in a few words, for the sentence "At ___, your body uses...".
 *
 * FOUR OF THESE SAID "the level you have set", which is the app telling her it
 * knows and declining to say - and the level is the single biggest term in the
 * figure underneath. They say which week she picked now, in her own terms, so the
 * sentence is checkable by reading it.
 *
 * LOWERCASE ON PURPOSE, and not a contradiction of her capital rule. These land
 * mid-sentence after "At", where a capital is the thing that would look broken;
 * the rule is about segments that START a line. The activity screen shows the
 * same levels as full sentences, capitalised.
 */
const ACTIVITY_WORD: Record<string, string> = {
  sedentary: 'mostly sitting',
  light: 'training once or twice a week',
  moderate: 'training three to five times a week',
  active: 'training most days',
  very_active: 'training twice a day',
};

const FACTOR: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const styles = StyleSheet.create({
  card: {
    borderRadius: CardRadius,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  headLine: { flexGrow: 1, flexShrink: 1, paddingVertical: Spacing.one },
  pause: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: ButtonRadius,
    borderWidth: 1,
  },
  body: { gap: Spacing.three, paddingTop: Spacing.three },
  link: { textDecorationLine: 'underline' },
  safetyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  safetyText: { flexGrow: 1, flexShrink: 1 },
  query: {
    borderWidth: 1,
    borderRadius: 999,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclosure: { gap: Spacing.one },
  disclosureHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  pressed: { opacity: 0.6 },
});
