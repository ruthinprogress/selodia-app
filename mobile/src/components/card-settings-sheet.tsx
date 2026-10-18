import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Toggle } from '@/components/toggle';
import { BottomTabInset, CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { plannedTime } from '@/lib/day-time';
import { offsetLabel, REMINDER_OFFSETS, type WeekCardEdit } from '@/lib/week-card';

// TIME, HOW LONG, AND WHETHER IT NUDGES YOU.
//
// Ruth, 18 October 2026, from one sitting with the app:
//
//   "I cant find how to set the reminder alarm/notification for the activity
//    card."
//   "There is no way to edit the start time or duration time for the activity."
//
// Both true. A card could be created with a time and then never changed, and
// the reminder had a complete layer underneath it - scheduling, the weekly
// fire, an off switch inside the notification itself - with no door into it
// from any screen. This is the door, and it holds all three because an offset
// reminder is "half an hour before my class" and so is meaningless until the
// class has a time. Separating them would mean leaving one sheet to make the
// other possible.
//
// HER WORDS STAY HER WORDS. The time field is free text and always will be:
// "7pm", "evening", "after the school run" and "before work" are all answers
// somebody gives and only one is a clock. day-time.ts has refused to parse that
// away since the beginning. What this sheet adds is showing her what the app
// UNDERSTOOD, right under the box, so the one case that matters - a clock time
// it could not read - is visible before she leaves rather than discovered when
// an alarm does not arrive.

export type CardToEdit = {
  id: string;
  activity: string;
  timeOfDay: string | null;
  duration: string | null;
  remindAt: string | null;
  remindOffsetMinutes: number | null;
};

export function CardSettingsSheet({
  card,
  onClose,
  onSave,
}: {
  card: CardToEdit;
  onClose: () => void;
  onSave: (edit: WeekCardEdit) => Promise<void>;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const clearance = BottomTabInset || 80;

  const [timeOfDay, setTimeOfDay] = useState(card.timeOfDay ?? '');
  const [duration, setDuration] = useState(card.duration ?? '');
  const [remindOn, setRemindOn] = useState(card.remindAt != null);
  const [offset, setOffset] = useState<number>(card.remindOffsetMinutes ?? 0);
  // Only used when the card has no clock time of its own to be before.
  const [ownTime, setOwnTime] = useState(card.remindAt?.slice(0, 5) ?? '');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // WHAT THE APP MADE OF WHAT SHE TYPED, recomputed as she types so the answer
  // is never stale. 'clock' is the only kind an offset can hang off.
  const parsed = plannedTime(timeOfDay);
  const hasClock = parsed.kind === 'clock' && parsed.minutes != null;
  const ownTimeValid = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(ownTime.trim());

  // THE TIME THE REMINDER WOULD ACTUALLY FIRE AT, which is the clock time when
  // the card has one and her own answer when it does not. A reminder with
  // neither cannot be saved, and the button says so rather than failing.
  const remindAt = hasClock
    ? `${String(Math.floor((parsed.minutes as number) / 60)).padStart(2, '0')}:${String(
        (parsed.minutes as number) % 60
      ).padStart(2, '0')}`
    : ownTimeValid
      ? ownTime.trim().padStart(5, '0')
      : null;
  const canSave = !remindOn || remindAt != null;

  async function save() {
    if (saving || !canSave) return;
    setSaving(true);
    setFailed(false);
    try {
      await onSave({
        timeOfDay: timeOfDay.trim() || null,
        duration: duration.trim() || null,
        remindAt: remindOn ? remindAt : null,
        // An offset only means anything against the card's own clock time. When
        // she gave the reminder its own time, that time IS the moment.
        remindOffsetMinutes: remindOn && hasClock ? offset : null,
      });
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ThemedView style={[styles.sheet, { paddingBottom: insets.bottom + clearance }]}>
          <View style={[styles.grabber, { backgroundColor: theme.backgroundSelected }]} />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <ThemedText type="sectionTitle">{card.activity}</ThemedText>

            {/* WHEN */}
            <ThemedText type="small" themeColor="textSecondary">
              When
            </ThemedText>
            <TextInput
              value={timeOfDay}
              onChangeText={setTimeOfDay}
              placeholder="7pm, evening, after the school run"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="When it happens"
              style={[styles.input, { borderColor: theme.backgroundSelected, color: theme.text }]}
            />
            {/* THE ONE THING WORTH SAYING BACK. Not a correction and never a
                refusal - "evening" is a perfectly good answer and stays as she
                wrote it. But a reminder needs a clock, so when there is no
                clock the sheet says what that costs, here, before she leaves. */}
            {timeOfDay.trim() ? (
              <ThemedText type="small" themeColor="textSecondary">
                {hasClock
                  ? `Shows on the card as ${parsed.label}.`
                  : `Shows on the card as "${parsed.label ?? timeOfDay.trim()}". That is kept as you wrote it. A reminder needs a clock time, so it will ask for one of its own below.`}
              </ThemedText>
            ) : null}

            {/* HOW LONG */}
            <ThemedText type="small" themeColor="textSecondary">
              How long
            </ThemedText>
            <TextInput
              value={duration}
              onChangeText={setDuration}
              placeholder="60 min, 1.5 hrs"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="How long it takes"
              style={[styles.input, { borderColor: theme.backgroundSelected, color: theme.text }]}
            />

            {/* REMINDER */}
            <View style={styles.rule} />
            <Toggle
              checked={remindOn}
              onToggle={() => setRemindOn((v) => !v)}
              label="Remind me"
              hint="Every week, on the days this is on"
            />

            {remindOn ? (
              hasClock ? (
                <>
                  {/* HER OWN FOUR, NAMED: "it can offer 10mins, 15mins, 30mins
                      1hr before". Plus "at the time", which is what somebody
                      means when they decline all four. */}
                  <ThemedText type="small" themeColor="textSecondary">
                    {`${parsed.label} on the day, so:`}
                  </ThemedText>
                  <View style={styles.offsets}>
                    {REMINDER_OFFSETS.map((m) => {
                      const on = offset === m;
                      return (
                        <Pressable
                          key={m}
                          onPress={() => setOffset(m)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                          accessibilityLabel={offsetLabel(m)}
                          style={({ pressed }) => pressed && styles.pressed}>
                          <ThemedView
                            type={on ? 'backgroundSelected' : 'backgroundElement'}
                            style={[
                              styles.chip,
                              { borderColor: on ? theme.accentDeep : 'transparent' },
                            ]}>
                            <ThemedText type="small" themeColor={on ? 'accentDeep' : 'text'}>
                              {offsetLabel(m)}
                            </ThemedText>
                          </ThemedView>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : (
                <>
                  {/* NO CLOCK ON THE CARD, so the reminder needs one of its own.
                      It does NOT get written back into the When box: "evening"
                      is what she said this happens, and 18:30 is only when she
                      wants telling. Those are different facts. */}
                  <ThemedText type="small" themeColor="textSecondary">
                    What time should it reach you?
                  </ThemedText>
                  <TextInput
                    value={ownTime}
                    onChangeText={setOwnTime}
                    placeholder="18:30"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numbers-and-punctuation"
                    accessibilityLabel="Time the reminder arrives, as hours and minutes"
                    style={[
                      styles.input,
                      { borderColor: theme.backgroundSelected, color: theme.text },
                    ]}
                  />
                  {ownTime.trim() && !ownTimeValid ? (
                    <ThemedText type="small" themeColor="accentDeep">
                      Needs to be a time like 18:30.
                    </ThemedText>
                  ) : null}
                </>
              )
            ) : null}

            {remindOn ? (
              <ThemedText type="small" themeColor="textSecondary">
                It comes every week and you can stop it from the notification itself, without
                opening the app.
              </ThemedText>
            ) : null}

            {failed ? (
              <ThemedText type="small" themeColor="accentDeep">
                That did not save. Check your connection and try again.
              </ThemedText>
            ) : null}

            <Pressable
              onPress={() => void save()}
              accessibilityRole="button"
              accessibilityState={{ disabled: saving || !canSave }}
              style={({ pressed }) => pressed && styles.pressed}>
              <View
                style={[
                  styles.cta,
                  { backgroundColor: canSave ? theme.accentDeep : theme.backgroundSelected },
                ]}>
                <ThemedText type="smallBold" themeColor={canSave ? 'background' : 'textSecondary'}>
                  {saving ? 'Saving…' : canSave ? 'Save' : 'Needs a time for the reminder'}
                </ThemedText>
              </View>
            </Pressable>
          </ScrollView>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create<{
  scrim: ViewStyle;
  sheet: ViewStyle;
  grabber: ViewStyle;
  body: ViewStyle;
  input: TextStyle;
  rule: ViewStyle;
  offsets: ViewStyle;
  chip: ViewStyle;
  cta: ViewStyle;
  pressed: ViewStyle;
}>({
  scrim: { flex: 1, backgroundColor: 'rgba(23, 13, 9, 0.35)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' },
  grabber: { width: 44, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.three },
  body: { padding: Spacing.four, gap: Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: CardRadius,
    paddingHorizontal: Spacing.three,
    // 44 is the smallest a control should be, and a text box is a control.
    minHeight: 44,
  },
  rule: { height: 1, opacity: 0.12, backgroundColor: '#170D09', marginVertical: Spacing.two },
  offsets: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: CardRadius,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  cta: {
    borderRadius: CardRadius,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  pressed: { opacity: 0.7 },
});
