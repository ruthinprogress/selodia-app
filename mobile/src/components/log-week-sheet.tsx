import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, CardRadius, Spacing } from '@/constants/theme';

// BottomTabInset is a Platform.select of ios and android, so it is 0 on web -
// which is precisely where a Modal shares a document with the tab bar and the
// overlap occurs. On native the Modal draws above the bar and this padding is
// simply a little breathing room at the bottom of a sheet, which is no loss.
const TAB_CLEARANCE = BottomTabInset || 80;
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { DAY_LABEL, dayKeyOf, shortDate } from '@/lib/week-plan';

// LOGGING THE WEEK IN ONE GO (Ruth's design screen 3, 29 September 2026).
//
// "Untick anything that didn't happen."
//
// EVERYTHING UP TO TODAY ARRIVES TICKED, and that is the whole design. A list
// that arrives empty asks her to account for her week item by item; a list that
// arrives ticked assumes she did what she planned, which is usually true and is
// the more generous assumption to be wrong about. She unticks the exceptions.
//
// THE FUTURE IS SHOWN AND CANNOT BE TICKED. Thursday's gym on a Tuesday appears
// greyed, marked "Later this week", with no box. Hiding it would make the week
// look shorter than it is; offering a box would invite a log for something that
// has not happened.
//
// NOTHING IS EVER MARKED MISSED. Unticking removes a row from what gets
// written. It does not record a failure, it is not counted, and nothing
// anywhere afterwards knows it was unticked. That is the difference between a
// witness and a register.

export type WeekLogItem = {
  /** The user_week row. */
  planId: string;
  activity: string;
  duration: string | null;
  /** The date this is planned for, this week. */
  date: Date;
  /** Already logged, so it is not offered again. */
  alreadyLogged: boolean;
};

const endOfToday = () => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59);
};
const isPast = (d: Date) => d.getTime() <= endOfToday().getTime();

// MOUNTED ONLY WHILE IT IS OPEN, so the ticks are computed once at first
// render from the items it was given. The first version kept it mounted and
// filled them in an effect keyed on `open`, which the React Compiler lint
// refuses - and rightly: the parent rebuilds `items` on every render, so any
// dependency on it would have wiped her ticks continuously while she read the
// list.
export function LogWeekSheet({
  items,
  onClose,
  onLog,
}: {
  items: WeekLogItem[];
  onClose: () => void;
  onLog: (chosen: WeekLogItem[]) => Promise<void>;
}) {
  const theme = useTheme();
  // THE SHEET CLEARS THE TAB BAR, not its contents.
  //
  // A sheet is a Modal, and on web that draws into the same document as the
  // navigation, so "Log it" sat underneath the tab bar. The first attempt
  // padded the SCROLL CONTENT, which only pushed the button further down
  // inside a scroller whose own bottom edge was already behind the bar - the
  // button went from half-hidden to entirely hidden.
  //
  // The padding belongs on the sheet itself, so its floor rises above the bar
  // and everything inside comes with it.
  //
  // AND IT NEEDS A WEB FALLBACK, which is why TAB_CLEARANCE exists below rather
  // than using BottomTabInset directly: that constant is a Platform.select of
  // ios and android only, so on web it resolves to undefined and then to 0 -
  // and web is the one place the overlap actually happens.
  const insets = useSafeAreaInsets();
  // EVERYTHING UP TO TODAY ARRIVES TICKED. See the header.
  const [ticked, setTicked] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    for (const it of items) {
      if (!it.alreadyLogged && isPast(it.date)) next[key(it)] = true;
    }
    return next;
  });
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const past = items.filter((i) => isPast(i.date));
  const later = items.filter((i) => !isPast(i.date));
  const chosen = past.filter((i) => !i.alreadyLogged && ticked[key(i)]);

  async function submit() {
    if (saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await onLog(chosen);
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
      <ThemedView style={[styles.sheet, { paddingBottom: insets.bottom + TAB_CLEARANCE }]}>
        <View style={[styles.grabber, { backgroundColor: theme.backgroundSelected }]} />
        <ScrollView contentContainerStyle={styles.body}>
          <ThemedText type="sectionTitle">Log the week</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Untick anything that didn&apos;t happen.
          </ThemedText>

          {past.length === 0 && later.length === 0 && (
            <ThemedView type="backgroundElement" style={styles.row}>
              <ThemedText type="small" themeColor="textSecondary">
                Nothing planned this week yet.
              </ThemedText>
            </ThemedView>
          )}

          {past.map((item) => {
            const k = key(item);
            const on = Boolean(ticked[k]);
            if (item.alreadyLogged) {
              return (
                <ThemedView key={k} type="backgroundElement" style={styles.row}>
                  <View style={styles.rowText}>
                    <ThemedText type="smallBold">{item.activity}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {DAY_LABEL[dayKeyOf(item.date)]} {shortDate(item.date)}
                      {item.duration ? ` · ${item.duration}` : ''}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Already logged
                    </ThemedText>
                  </View>
                </ThemedView>
              );
            }
            return (
              <Pressable
                key={k}
                onPress={() => setTicked((p) => ({ ...p, [k]: !p[k] }))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${item.activity}, ${DAY_LABEL[dayKeyOf(item.date)]} ${shortDate(item.date)}`}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.row}>
                  <ThemedView
                    type={on ? 'backgroundSelected' : 'background'}
                    style={[styles.box, { borderColor: on ? theme.accentDeep : theme.backgroundSelected }]}>
                    {on && <ThemedText type="smallBold" themeColor="accentDeep">✓</ThemedText>}
                  </ThemedView>
                  <View style={styles.rowText}>
                    <ThemedText type="smallBold">{item.activity}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {DAY_LABEL[dayKeyOf(item.date)]} {shortDate(item.date)}
                      {item.duration ? ` · ${item.duration}` : ''}
                    </ThemedText>
                  </View>
                </ThemedView>
              </Pressable>
            );
          })}

          {later.map((item) => (
            // GREYED, WITH NO BOX. Present so the week reads as a whole week,
            // and unactionable because it has not happened.
            <ThemedView key={key(item)} type="backgroundElement" style={[styles.row, styles.later]}>
              <View style={styles.rowText}>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.activity}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {DAY_LABEL[dayKeyOf(item.date)]} {shortDate(item.date)}
                  {item.duration ? ` · ${item.duration}` : ''}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Later this week
                </ThemedText>
              </View>
            </ThemedView>
          ))}

          {failed && (
            <ThemedText type="small" themeColor="danger">
              That didn&apos;t save. Check your connection and try again.
            </ThemedText>
          )}
        </ScrollView>

        {/* PINNED, OUTSIDE THE SCROLLER. This list is the one most likely to be
            long - every planned day of the week - so a button that scrolls away
            with the content is the worst case here, not the best. */}
        <View style={styles.footer}>
          <Pressable
            onPress={() => void submit()}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving || chosen.length === 0 }}
            disabled={saving || chosen.length === 0}
            style={({ pressed }) => pressed && styles.pressed}>
            <View
              style={[
                styles.cta,
                { backgroundColor: chosen.length === 0 ? theme.backgroundSelected : theme.accentDeep },
              ]}>
              <ThemedText
                type="smallBold"
                themeColor={chosen.length === 0 ? 'textSecondary' : 'background'}>
                {saving ? 'Logging…' : 'Log these'}
              </ThemedText>
            </View>
          </Pressable>
        </View>
      </ThemedView>
    </Modal>
  );
}

// A plan can be on more than one day in a week, so the id alone is not unique.
const key = (i: WeekLogItem) => `${i.planId}:${i.date.toDateString()}`;

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
  // THE SHEET CARRIES THE TAB CLEARANCE, so the body does not need its own
  // deep bottom padding as well. With both, the two added up past the sheet's
  // maxHeight and clipped the button in half.
  body: { padding: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: CardRadius,
  },
  later: { opacity: 0.55 },
  rowText: { flex: 1, gap: 2 },
  box: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  cta: {
    paddingVertical: Spacing.three,
    borderRadius: 999,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
});
