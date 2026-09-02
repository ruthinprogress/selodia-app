import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DEFAULT_REMINDER_TIMES, persistReminderChoice } from '@/lib/reminder-settings';
import { nextFireTime } from '@/lib/quiet-hours';
import { supabase } from '@/lib/supabase';

// The reminder offer (Part Fourteen).
//
// APPEARS AT THE FIRST LOG, never as a generic upfront prompt. The spec is
// explicit and the reason is worth keeping: a permission dialog before someone
// has any reason to want reminders asks for trust that has not been earned. By
// the first log there is a reason, and it is theirs.
//
// It appears ONCE. Whichever way it is answered - including "no" - is recorded
// with asked_at, and the offer never returns. That is the whole point of
// storing a decline rather than just an absence.
//
// Three options, exactly as specified: the sensible default, custom times, and
// a genuine no that is not framed as a lesser choice.

export function ReminderOffer({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const [custom, setCustom] = useState(false);
  const [times, setTimes] = useState(DEFAULT_REMINDER_TIMES.join(', '));
  const [saving, setSaving] = useState(false);

  async function choose(enabled: boolean, chosen?: string[]) {
    if (saving) return;
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // The choice is RECORDED first, and on any binary: that is a Supabase
        // write with nothing native about it, and it must survive even where
        // push does not exist - otherwise someone answers the question and gets
        // asked again tomorrow.
        const times = await persistReminderChoice(user.id, { enabled, times: chosen });

        // Push is reached only here, only on a yes, and only through a dynamic
        // import - so this component never drags expo-notifications into the
        // Chat screen's module graph. On a binary without it, isPushAvailable
        // returns false and the whole block is skipped rather than throwing.
        if (enabled) {
          try {
            const push = await import('@/lib/notifications');
            if (push.isPushAvailable()) {
              await push.registerPushToken(user.id);
              await push.applyReminderSchedule(times);
            }
          } catch {
            // Reminders are unavailable on this build. The preference is saved
            // either way, so a later build honours it without re-asking.
          }
        }
      }
    } finally {
      setSaving(false);
      onDone();
    }
  }

  // Free text rather than a picker, matching how everything else in this app is
  // entered. Anything unparseable is dropped rather than rejected with an
  // error: a half-understood "8pm, 9" should set the times it did understand,
  // not scold someone over a comma.
  function parseTimes(raw: string): string[] {
    return raw
      .split(/[,\n]/)
      .map((t) => t.trim())
      .filter((t) => nextFireTime(t) !== null);
  }

  const parsed = parseTimes(times);

  return (
    <ThemedView type="backgroundElement" style={styles.card} accessibilityRole="summary">
      <ThemedText type="small">Would you like help remembering to log?</ThemedText>

      {custom ? (
        <View style={styles.customBlock}>
          <TextInput
            value={times}
            onChangeText={setTimes}
            placeholder="e.g. 14:00, 20:00"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
            autoFocus
          />
          {/* Says what will actually happen, including a time pushed out of
              quiet hours, so nothing about the schedule is a surprise later. */}
          <ThemedText type="small" themeColor="textSecondary">
            {parsed.length > 0
              ? `I'll check in at ${parsed.join(' and ')}. Nothing between 9pm and 7am.`
              : "I didn't catch a time in that. Something like 14:00 works."}
          </ThemedText>
          <View style={styles.row}>
            <Choice
              label="That's it"
              disabled={saving || parsed.length === 0}
              onPress={() => choose(true, parsed)}
            />
            <Choice label="Back" quiet disabled={saving} onPress={() => setCustom(false)} />
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <Choice label="2pm and 8pm" disabled={saving} onPress={() => choose(true, DEFAULT_REMINDER_TIMES)} />
          <Choice label="Custom times" disabled={saving} onPress={() => setCustom(true)} />
          {/* Not phrased as declining something. "I've got this" is the spec's
              own wording and it reads as a capable choice, which it is. */}
          <Choice label="No reminders, I've got this" quiet disabled={saving} onPress={() => choose(false)} />
        </View>
      )}
    </ThemedView>
  );
}

function Choice({
  label,
  onPress,
  quiet,
  disabled,
}: {
  label: string;
  onPress: () => void;
  quiet?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => pressed && styles.pressed}
    >
      <ThemedView
        type={quiet ? 'backgroundElement' : 'backgroundSelected'}
        style={[styles.choice, disabled && styles.disabled]}
      >
        <ThemedText type="smallBold" themeColor={quiet ? 'textSecondary' : 'text'}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  customBlock: { gap: Spacing.two },
  choice: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
  input: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
