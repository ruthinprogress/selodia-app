import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import {
  loadCustomReminders,
  reminderSummary,
  stopCustomReminder,
  type CustomReminder,
} from '@/lib/custom-reminders';
import { syncRemindersNow } from '@/lib/notifications';

// The reminders she asked for, listed where she can stop them (2026-09-18).
//
// THEY ARE SET BY ASKING, and that is the point of the feature - but a thing
// that can only be turned off by remembering the right sentence is a thing
// somebody eventually feels stuck with. So they are also here, in plain sight,
// each with one control.
//
// NOTHING IS SHOWN WHEN THERE ARE NONE. This is not a feature to advertise in
// Settings; it is a list of what exists, and an empty list is not a list.
export function CustomReminderList() {
  const [rows, setRows] = useState<CustomReminder[]>([]);
  const [stopping, setStopping] = useState<string | null>(null);

  const load = useCallback(() => {
    void (async () => setRows(await loadCustomReminders()))();
  }, []);

  useFocusEffect(load);

  if (rows.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold">Reminders you asked for</ThemedText>
      <ThemedView type="backgroundElement" style={styles.card}>
        {rows.map((r, i) => (
          <View key={r.id} style={[styles.row, i > 0 && styles.divided]}>
            <ThemedText type="small" style={styles.label}>
              {reminderSummary(r)}
            </ThemedText>
            <Pressable
              onPress={() => {
                void (async () => {
                  setStopping(r.id);
                  const ok = await stopCustomReminder(r.id);
                  if (ok) {
                    setRows((prev) => prev.filter((x) => x.id !== r.id));
                    // The phone has to forget it too, or it keeps arriving.
                    await syncRemindersNow();
                  }
                  setStopping(null);
                })();
              }}
              disabled={stopping === r.id}
              accessibilityRole="button"
              accessibilityLabel={`Stop the reminder: ${reminderSummary(r)}`}
              hitSlop={Spacing.two}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedText type="small" themeColor="accentDeep">
                Stop
              </ThemedText>
            </Pressable>
          </View>
        ))}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  card: { borderRadius: CardRadius, paddingHorizontal: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(45,43,40,0.12)' },
  label: { flex: 1 },
  pressed: { opacity: 0.6 },
});
