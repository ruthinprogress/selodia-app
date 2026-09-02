import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authedPost } from '@/lib/api';
import {
  formatWeight,
  parseTypedWeight,
  positionToWeight,
  sliderRange,
  weightToPosition,
  WEIGHT_STEP_KG,
} from '@/lib/working-weight';

// The working-weight control (build item 35, slice E).
//
// A slider at 1kg increments with the number ALWAYS directly editable, per the
// settled design. Hand-built from touch handlers rather than a slider library: every RN slider package is a NATIVE module, which would force an EAS
// rebuild and stack another native dependency ahead of photo logging. This is
// pure JS and ships over EAS Update like the rest of today's work.
//
// Worth knowing about the slider itself: across a 0-40kg range on a phone track
// each 1kg is only a few pixels, so dragging is for getting close and the typed
// field is for landing exactly. That is precisely why the design pairs them,
// and why the field is not hidden behind an "edit" affordance.
//
// Logging APPENDS. It never overwrites the previous value - the plan displays
// current = latest, and progressive overload depends on the history being kept.

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

  const trackWidth = useRef(0);

  function setFromFraction(fraction: number) {
    const kg = positionToWeight(fraction, range);
    setValue(kg);
    setText(formatWeight(kg));
    setError(null);
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
  }

  async function log() {
    // The typed field is authoritative — someone may have typed a value the
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
    } catch {
      // Never report a save that did not happen.
      setError("Couldn't save that. Try again");
    } finally {
      setSaving(false);
    }
  }

  const fraction = weightToPosition(value, range);

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
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundElement" style={styles.nudge}>
            <ThemedText type="smallBold">−</ThemedText>
          </ThemedView>
        </Pressable>

        {/* Always editable, never behind an affordance: typing is the only way
            to hit the odd numbers real equipment produces. */}
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            const parsed = parseTypedWeight(t);
            if (parsed != null) setValue(parsed);
          }}
          keyboardType="decimal-pad"
          accessibilityLabel="Working weight in kilograms"
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />
        <ThemedText type="small" themeColor="textSecondary">
          kg
        </ThemedText>

        <Pressable
          onPress={() => nudge(WEIGHT_STEP_KG)}
          accessibilityRole="button"
          accessibilityLabel="Increase by 1 kilogram"
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundElement" style={styles.nudge}>
            <ThemedText type="smallBold">+</ThemedText>
          </ThemedView>
        </Pressable>
      </View>

      <View
        style={[styles.track, { backgroundColor: theme.backgroundElement }]}
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
        <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: theme.textSecondary }]} />
      </View>

      {error && (
        <ThemedText type="small" style={[styles.error, { color: theme.danger }]}>
          {error}
        </ThemedText>
      )}

      <Pressable onPress={log} disabled={saving} style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView
          type="backgroundSelected"
          style={[styles.save, saving && styles.savingState]}
        >
          <ThemedText type="smallBold">{saving ? 'Saving…' : 'Log this weight'}</ThemedText>
        </ThemedView>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two, marginTop: Spacing.three },
  label: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  nudge: {
    width: 36,
    height: 36,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    minWidth: 72,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    textAlign: 'center',
    fontSize: 16,
  },
  track: { height: 28, borderRadius: 14, overflow: 'hidden', justifyContent: 'center' },
  fill: { height: '100%', borderRadius: 14 },
  error: { fontSize: 11 },
  save: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  savingState: { opacity: 0.6 },
  pressed: { opacity: 0.6 },
});
