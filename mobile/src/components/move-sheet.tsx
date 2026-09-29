import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DAY_LABEL, dayKeyOf, shortDate } from '@/lib/week-plan';
import { toggleDay } from '@/lib/week-move';

// "MOVE TO…" - THE ROUTE THAT IS ALWAYS THERE (Ruth, 29 September 2026:
// "I want both drag and a 'Move to…' option; not one or the other ... it's
// also the accessible route, since screen reader users can't drag.")
//
// That last clause is the whole argument. A drag cannot be performed with
// TalkBack on, cannot be performed one-handed on a bus, and cannot be
// performed by anyone whose hands are having a bad day - which, for an app
// built for women over forty, is not an edge case. So this is not a fallback
// for when the drag fails. It is the primary route, and the drag is the
// shortcut for whoever reaches for it.
//
// It lives in its own file because three places open it now: a long press on
// a card, the end of a drag that landed nowhere, and "Move to…" in the tap
// sheet. When it lived inside week-view.tsx the tap sheet could not reach it
// without importing the whole week.

export function MoveSheet({
  activity,
  days,
  weekDays,
  onClose,
  onPick,
}: {
  /** Named in the title, so the sheet says what it is moving. */
  activity: string;
  /** The days it is on now, so the chips show what is already true. */
  days: string[];
  /** This week's seven dates, for the labels. */
  weekDays: Date[];
  onClose: () => void;
  /** An empty list means Anytime this week. */
  onPick: (days: string[]) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // BottomTabInset is a Platform.select of ios and android, so it is 0 on web -
  // which is where a Modal shares a document with the tab bar and the overlap
  // happens. See log-plan-sheet.tsx, same reasoning.
  const clearance = BottomTabInset || 80;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <ThemedView style={[styles.sheet, { paddingBottom: insets.bottom + clearance }]}>
        <View style={[styles.grabber, { backgroundColor: theme.backgroundSelected }]} />
        <View style={styles.body}>
          <ThemedText type="sectionTitle">Move {activity}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Tap a day to put it there, or tap it again to take it off.
          </ThemedText>

          <View style={styles.grid}>
            {weekDays.map((d) => {
              const key = dayKeyOf(d);
              const on = days.includes(key);
              return (
                <Pressable
                  key={key}
                  onPress={() => onPick(toggleDay(days, key))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  // THE WHOLE SENTENCE, because a screen reader user gets no
                  // help from the layout. "Monday 28 September, on" is what
                  // the chip means; "Mon" is what it says.
                  accessibilityLabel={`${DAY_LABEL[key]} ${shortDate(d)}`}
                  accessibilityHint={on ? 'Takes it off this day' : 'Puts it on this day'}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <ThemedView
                    type={on ? 'backgroundSelected' : 'backgroundElement'}
                    style={[styles.chip, { borderColor: on ? theme.accentDeep : 'transparent' }]}>
                    <ThemedText type="small" themeColor={on ? 'accentDeep' : 'text'}>
                      {DAY_LABEL[key]}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => onPick([])}
            accessibilityRole="button"
            accessibilityLabel="Move to Anytime this week"
            accessibilityHint="Takes it off every day"
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.anytime}>
              <ThemedText type="smallBold">Anytime this week</ThemedText>
            </ThemedView>
          </Pressable>
        </View>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(23, 13, 9, 0.35)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' },
  grabber: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.three,
  },
  body: { padding: Spacing.four, gap: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  chip: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: CardRadius,
    borderWidth: 1,
    // 44 is the smallest a control should be. These are wider than they are
    // tall, so the height is the one to hold.
    minHeight: 44,
    justifyContent: 'center',
  },
  anytime: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: CardRadius,
    alignItems: 'center',
    marginTop: Spacing.two,
    minHeight: 44,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});
