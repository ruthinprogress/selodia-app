import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { weekStartFor } from '@/lib/week';

// The far-jump entry point (Part Five, Historical Browsing — build item 44).
//
// Week-by-week stepping stays the calm default for ordinary browsing; this
// exists solely for the deliberate far jump, and the spec is specific about how:
// it opens ONLY when someone reaches for it, is never persistent, and is styled
// on-brand — square month buttons and a year scroller in the app's own palette
// — rather than as a native OS date picker.
//
// (@react-native-community/datetimepicker is already a dependency and would
// have been less work. It is deliberately not used here: it renders the
// platform's own dialog, which is exactly the look the spec rules out.)

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// How far back the year scroller reaches. Nothing exists before the app did, so
// offering 1990 would be offering empty screens.
const EARLIEST_YEAR = 2026;

export function MonthYearPicker({
  visible,
  onCancel,
  onSelect,
  initial = new Date(),
}: {
  visible: boolean;
  onCancel: () => void;
  // Hands back the Monday of the chosen month's first week, because the weekly
  // table is addressed by week start - the picker chooses a month, the table
  // lands on a week, and this is where that translation belongs.
  onSelect: (weekStart: Date) => void;
  initial?: Date;
}) {
  const theme = useTheme();
  const now = new Date();
  const [year, setYear] = useState(initial.getFullYear());

  const years: number[] = [];
  for (let y = now.getFullYear(); y >= EARLIEST_YEAR; y--) years.push(y);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} accessibilityViewIsModal>
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.scrim }]}
        onPress={onCancel}
        accessibilityLabel="Close"
      >
        <Pressable style={styles.sheetWrap} onPress={() => {}}>
          <ThemedView style={styles.sheet}>
            <ThemedText type="smallBold" style={styles.title}>
              Jump to
            </ThemedText>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.years}>
              {years.map((y) => {
                const active = y === year;
                return (
                  <Pressable key={y} onPress={() => setYear(y)} style={({ pressed }) => pressed && styles.pressed}>
                    <ThemedView
                      type={active ? 'backgroundSelected' : 'backgroundElement'}
                      style={styles.yearChip}
                    >
                      <ThemedText type="smallBold" themeColor={active ? 'text' : 'textSecondary'}>
                        {y}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.grid}>
              {MONTHS.map((label, i) => {
                // A month that has not happened yet holds nothing, so it is
                // disabled rather than leading somewhere empty - the same
                // reasoning principle 8 applies to dead controls.
                const future = year > now.getFullYear() || (year === now.getFullYear() && i > now.getMonth());
                return (
                  <Pressable
                    key={label}
                    disabled={future}
                    onPress={() => onSelect(weekStartFor(new Date(year, i, 1)))}
                    style={({ pressed }) => pressed && styles.pressed}
                    accessibilityRole="button"
                    accessibilityLabel={`${label} ${year}`}
                    accessibilityState={{ disabled: future }}
                  >
                    <ThemedView
                      type="backgroundElement"
                      style={[styles.monthButton, future && styles.disabled]}
                    >
                      <ThemedText type="smallBold" themeColor={future ? 'textSecondary' : 'text'}>
                        {label}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                );
              })}
            </View>

            <Pressable onPress={onCancel} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.cancel}>
                Cancel
              </ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  sheetWrap: { width: '100%', maxWidth: MaxContentWidth },
  sheet: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.three },
  title: { textAlign: 'center' },
  years: { gap: Spacing.two, paddingVertical: Spacing.one },
  yearChip: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, justifyContent: 'center' },
  // Square, per the spec - a month is a destination here, not a list item.
  monthButton: {
    width: 64,
    height: 64,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.35 },
  cancel: { textAlign: 'center', paddingTop: Spacing.one },
  pressed: { opacity: 0.7 },
});
