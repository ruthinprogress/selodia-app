import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BodyFont, ButtonRadius, DisplayFont, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authedPost } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import {
  describeHistory,
  formatWeight,
  parseTypedWeight,
  positionToWeight,
  sliderRange,
  weightToPosition,
  WEIGHT_STEP_KG,
  type WeightHistoryRow,
} from '@/lib/working-weight';

// The working-weight control (build item 35, slice E; redrawn 2026-09-18 to
// Ruth's Movement brief: "a larger working-weight selector with gentle
// historical context, and Save working weight").
//
// WHAT CHANGED AND WHY. It was a 16px number in a row of small grey chips, the
// same size as every other line on the sheet - so the one thing a person comes
// to this sheet to change looked like a form field on a settings page. It is now
// the largest thing on the screen, centred, in the serif the app names things
// in, with the minus and plus set well out to either side where a thumb goes.
//
// STILL DIRECTLY EDITABLE, which is the part of the settled design that must not
// be lost (2026-08-21): the big number IS the text field. Real equipment lands
// on odd values - Smith machines, oddly weighted bars, whatever plates a gym
// owns - and no increment chosen in advance can anticipate them. The slider gets
// you close; typing lands exactly.
//
// Hand-built from touch handlers rather than a slider library: every RN slider
// package is a NATIVE module, which would force an EAS rebuild. This is pure JS
// and ships over EAS Update like the rest of the UI pass.
//
// LOGGING APPENDS. It never overwrites the previous value - the plan displays
// current = latest, and progressive overload depends on the history being kept.
// That same history is what the line under the slider reads.

export function WorkingWeightControl({
  planId,
  exerciseName,
  currentKg,
  onLogged,
}: {
  planId: string;
  exerciseName: string;
  currentKg: number | null;
  onLogged: (kg: number) => void;
}) {
  const theme = useTheme();
  const range = sliderRange(currentKg);

  const [value, setValue] = useState<number>(currentKg ?? 0);
  const [text, setText] = useState<string>(formatWeight(currentKg ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<WeightHistoryRow[]>([]);

  const trackWidth = useRef(0);

  // THE HISTORY THIS EXERCISE ALREADY HAS. Read here rather than passed in: the
  // sheet above holds only the latest value per exercise, and the line under
  // the slider needs the one before it too. RLS scopes the read.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('workout_weight_log')
        .select('weight_kg, logged_at')
        .eq('plan_id', planId)
        .eq('exercise_name', exerciseName)
        .order('logged_at', { ascending: false })
        .limit(20);
      if (!cancelled) setHistory((data ?? []) as WeightHistoryRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [planId, exerciseName]);

  function setFromFraction(fraction: number) {
    const kg = positionToWeight(fraction, range);
    setValue(kg);
    setText(formatWeight(kg));
    setError(null);
    setSaved(false);
  }

  // Plain touch handlers rather than a PanResponder held in a ref. A responder
  // created once closes over the FIRST `range`, so it would keep using a stale
  // scale after currentKg changed - a real bug, not just a lint complaint.
  // These are re-created each render and always see the current range.
  function onTouch(locationX: number) {
    if (trackWidth.current > 0) setFromFraction(locationX / trackWidth.current);
  }

  function nudge(delta: number) {
    const next = Math.max(range.min, Math.min(range.max, value + delta));
    setValue(next);
    setText(formatWeight(next));
    setError(null);
    setSaved(false);
  }

  async function log() {
    // The typed field is authoritative - someone may have typed a value the
    // slider could never land on, which is the whole point of it being editable.
    const typed = parseTypedWeight(text);
    if (typed == null) {
      setError('That does not look like a weight');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await authedPost('/api/log-working-weight', { planId, exerciseName, weightKg: typed });
      onLogged(typed);
      // Kept locally as well as reported upward, so the line underneath tells
      // the truth immediately rather than after the sheet is reopened.
      setHistory((h) => [{ weight_kg: typed, logged_at: new Date().toISOString() }, ...h]);
      setSaved(true);
    } catch {
      // Never report a save that did not happen.
      setError("Couldn't save that. Try again");
    } finally {
      setSaving(false);
    }
  }

  const fraction = weightToPosition(value, range);
  const context = describeHistory(history);

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        Working weight
      </ThemedText>

      <View style={styles.valueRow}>
        <Pressable
          onPress={() => nudge(-WEIGHT_STEP_KG)}
          accessibilityRole="button"
          accessibilityLabel="Decrease by 1 kilogram"
          hitSlop={Spacing.three}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundSelected" style={styles.nudge}>
            <ThemedText type="small">−</ThemedText>
          </ThemedView>
        </Pressable>

        {/* THE NUMBER IS THE FIELD. Large, centred, and typed over directly -
            no edit affordance to find, because typing is the only way to hit
            the odd numbers real equipment produces. */}
        <View style={styles.numberBlock}>
          <TextInput
            value={text}
            onChangeText={(t) => {
              setText(t);
              setSaved(false);
              const parsed = parseTypedWeight(t);
              if (parsed != null) setValue(parsed);
            }}
            keyboardType="decimal-pad"
            selectTextOnFocus
            accessibilityLabel="Working weight in kilograms"
            style={[styles.number, { color: theme.text }]}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.unit}>
            kg
          </ThemedText>
        </View>

        <Pressable
          onPress={() => nudge(WEIGHT_STEP_KG)}
          accessibilityRole="button"
          accessibilityLabel="Increase by 1 kilogram"
          hitSlop={Spacing.three}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundSelected" style={styles.nudge}>
            <ThemedText type="small">+</ThemedText>
          </ThemedView>
        </Pressable>
      </View>

      <View
        style={[styles.track, { backgroundColor: theme.backgroundSelected }]}
        onLayout={(e) => {
          trackWidth.current = e.nativeEvent.layout.width;
        }}
        accessibilityRole="adjustable"
        accessibilityLabel={`Working weight slider, ${formatWeight(value)} kilograms`}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => onTouch(e.nativeEvent.locationX)}
        onResponderMove={(e) => onTouch(e.nativeEvent.locationX)}
      >
        <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: theme.sage }]} />
      </View>

      {/* GENTLE CONTEXT, NOT A SCOREBOARD. What was saved, and when. No arrows,
          no "up from", no personal best: a working weight goes down in a deload
          week or after illness, and a control that scores it makes writing the
          honest number down feel like an admission. */}
      {context && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.context}>
          {context}
        </ThemedText>
      )}

      {error && (
        <ThemedText type="small" style={[styles.error, { color: theme.danger }]}>
          {error}
        </ThemedText>
      )}

      <Pressable
        onPress={log}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel="Save working weight"
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedView type="accentDeep" style={[styles.save, saving && styles.savingState]}>
          <ThemedText type="smallBold" themeColor="background">
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save working weight'}
          </ThemedText>
        </ThemedView>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three, marginTop: Spacing.three, alignItems: 'stretch' },
  label: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  nudge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The number and its unit as one centred object, so the unit sits against the
  // figure rather than drifting to the edge of the row.
  numberBlock: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  number: {
    fontFamily: DisplayFont.regular,
    fontSize: 46,
    // Cormorant Infant's own line box is taller than the figures need; a leading
    // just under the size keeps the number optically centred in the row.
    lineHeight: 50,
    minWidth: 90,
    paddingVertical: 0,
    textAlign: 'right',
  },
  unit: { fontFamily: BodyFont.regular, paddingLeft: Spacing.one },
  track: { height: 22, borderRadius: 11, overflow: 'hidden', justifyContent: 'center' },
  fill: { height: '100%', borderRadius: 11 },
  context: { textAlign: 'center' },
  error: { fontSize: 11, textAlign: 'center' },
  save: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: ButtonRadius,
    alignItems: 'center',
  },
  savingState: { opacity: 0.6 },
  pressed: { opacity: 0.6 },
});
