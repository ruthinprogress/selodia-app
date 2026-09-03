import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandFont, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  buildActivityMessage,
  DISTANCE_CHOICES,
  DURATION_CHOICES,
  EFFORTS,
  isValidKm,
  isValidMinutes,
  takesDistance,
  type Effort,
} from '@/lib/activity-sheet';

// The Activity tab's log sheet.
//
// It opens only when the typed text did not already say how long (see
// hasDuration). Somebody who wrote "a 45 minute run" has answered the question
// and is not asked it again.
//
// TWO REQUIRED ANSWERS, ONE OPTIONAL. Effort and duration are what the log needs
// to be true; distance is offered only for the activities that have one. "Log
// it" stays inert until both required answers exist, so the button never
// promises something the sheet cannot deliver.
//
// NO STREAKS, NO SCORES, NO PRAISE. The sheet takes three answers and closes.
// Nothing here congratulates anyone for opening it.

type Props = {
  visible: boolean;
  // What the person typed, e.g. "running". Shown back to them as the heading so
  // the sheet is visibly about the thing they just said.
  activityText: string;
  onCancel: () => void;
  // Receives the constructed sentence. The sheet does not log: the caller posts
  // it through the same route as Chat.
  onConfirm: (message: string) => void;
};

// One chip. Sand at rest, terracotta when chosen, and cream type on the
// terracotta: full-strength accent is a fill colour on this palette, never small
// text on cream, which measures 3.10:1 and fails AA.
//
// Defined at module scope rather than inside the sheet. A component created
// during render is a new type on every pass, so React unmounts and remounts the
// whole row each time - the lint rule that caught this is right, and the cost
// here would have been a chip that cannot hold focus.
function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? theme.accent : theme.backgroundElement },
        pressed && styles.pressed,
      ]}
    >
      <ThemedText
        type="small"
        style={[styles.chipText, { color: selected ? theme.background : theme.text }]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function ActivityLogSheet({ visible, activityText, onCancel, onConfirm }: Props) {
  const theme = useTheme();

  const [effort, setEffort] = useState<Effort | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [customMinutes, setCustomMinutes] = useState(false);
  const [minutesText, setMinutesText] = useState('');
  const [km, setKm] = useState<number | null>(null);
  const [customKm, setCustomKm] = useState(false);
  const [kmText, setKmText] = useState('');

  const showDistance = takesDistance(activityText);

  const resolvedMinutes = customMinutes ? Number(minutesText.replace(',', '.')) : minutes;
  const resolvedKm = customKm ? Number(kmText.replace(',', '.')) : km;

  const minutesOk = resolvedMinutes != null && isValidMinutes(resolvedMinutes);
  // Distance is optional, so "not filled in" is valid and only a filled-in
  // implausible number blocks the button.
  const kmOk = !customKm ? true : kmText.trim().length === 0 || isValidKm(resolvedKm as number);
  const canLog = effort != null && minutesOk && kmOk;

  function reset() {
    setEffort(null);
    setMinutes(null);
    setCustomMinutes(false);
    setMinutesText('');
    setKm(null);
    setCustomKm(false);
    setKmText('');
  }

  function cancel() {
    reset();
    onCancel();
  }

  function confirm() {
    if (!canLog || effort == null || resolvedMinutes == null) return;
    const distance = showDistance && resolvedKm != null && isValidKm(resolvedKm) ? resolvedKm : null;
    const message = buildActivityMessage({
      text: activityText,
      effort,
      minutes: resolvedMinutes,
      km: distance,
    });
    reset();
    onConfirm(message);
  }

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={cancel} accessibilityViewIsModal>
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.scrim }]}
        onPress={cancel}
        accessibilityLabel="Close"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.bottom}
        pointerEvents="box-none"
      >
        <ThemedView style={styles.sheet}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            <ThemedText type="small" themeColor="textSecondary">
              Logging
            </ThemedText>
            <ThemedText style={styles.heading}>{activityText}</ThemedText>

            <ThemedText type="smallBold" style={styles.rowLabel}>
              Effort
            </ThemedText>
            <View style={styles.chips}>
              {EFFORTS.map((e) => (
                <Chip
                  key={e.value}
                  label={e.label}
                  selected={effort === e.value}
                  onPress={() => setEffort(e.value)}
                />
              ))}
            </View>

            <ThemedText type="smallBold" style={styles.rowLabel}>
              Duration
            </ThemedText>
            <View style={styles.chips}>
              {DURATION_CHOICES.map((d) => (
                <Chip
                  key={d}
                  label={`${d} min`}
                  selected={!customMinutes && minutes === d}
                  onPress={() => {
                    setCustomMinutes(false);
                    setMinutes(d);
                  }}
                />
              ))}
              <Chip
                label="Custom"
                selected={customMinutes}
                onPress={() => {
                  setCustomMinutes(true);
                  setMinutes(null);
                }}
              />
            </View>
            {customMinutes && (
              <TextInput
                value={minutesText}
                onChangeText={setMinutesText}
                placeholder="Minutes"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                accessibilityLabel="Duration in minutes"
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.backgroundElement },
                ]}
              />
            )}

            {showDistance && (
              <>
                <ThemedText type="smallBold" style={styles.rowLabel}>
                  Distance
                  <ThemedText type="small" themeColor="textSecondary">
                    {'  optional'}
                  </ThemedText>
                </ThemedText>
                <View style={styles.chips}>
                  {DISTANCE_CHOICES.map((d) => (
                    <Chip
                      key={d}
                      label={`${d}k`}
                      selected={!customKm && km === d}
                      onPress={() => {
                        setCustomKm(false);
                        setKm(km === d ? null : d);
                      }}
                    />
                  ))}
                  <Chip
                    label="Custom"
                    selected={customKm}
                    onPress={() => {
                      setCustomKm(true);
                      setKm(null);
                    }}
                  />
                </View>
                {customKm && (
                  <TextInput
                    value={kmText}
                    onChangeText={setKmText}
                    placeholder="Kilometres"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Distance in kilometres"
                    style={[
                      styles.input,
                      { color: theme.text, backgroundColor: theme.backgroundElement },
                    ]}
                  />
                )}
              </>
            )}

            <Pressable
              onPress={confirm}
              disabled={!canLog}
              accessibilityRole="button"
              accessibilityLabel="Log it"
              accessibilityState={{ disabled: !canLog }}
              style={({ pressed }) => [
                styles.logButton,
                { backgroundColor: theme.accent },
                !canLog && styles.disabled,
                pressed && canLog && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold" style={{ color: theme.background }}>
                Log it
              </ThemedText>
            </Pressable>

            <Pressable onPress={cancel} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.cancel}>
                Cancel
              </ThemedText>
            </Pressable>
          </ScrollView>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  bottom: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    maxHeight: '85%',
  },
  scroll: { gap: Spacing.two },
  heading: {
    fontFamily: BrandFont.semibold,
    fontSize: 22,
    lineHeight: 30,
    marginBottom: Spacing.two,
  },
  rowLabel: { marginTop: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chipText: { fontFamily: BrandFont.medium },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  input: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    fontFamily: BrandFont.regular,
  },
  logButton: {
    marginTop: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  cancel: { textAlign: 'center', paddingVertical: Spacing.three },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
