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
import { BottomTabInset, CardRadius, Spacing } from '@/constants/theme';

// BottomTabInset is a Platform.select of ios and android, so it is 0 on web -
// which is precisely where a Modal shares a document with the tab bar and the
// overlap occurs. On native the Modal draws above the bar and this padding is
// simply a little breathing room at the bottom of a sheet, which is no loss.
const TAB_CLEARANCE = BottomTabInset || 80;
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { currentWeekStart, daysOfWeek } from '@/lib/week';
import { DAY_LABEL, dayKeyOf, shortDate, type DayKey } from '@/lib/week-plan';

// LOGGING A PLANNED ACTIVITY (Ruth's design screen 2, 29 September 2026).
//
// Tap a card on a day, or in Anytime, and this opens. Three answers, two of
// them pre-filled, and the third optional.
//
// NEVER A FUTURE DAY. Her instruction, and it is the one rule here that is
// about honesty rather than convenience: a log is a record of something that
// happened, and there is no such record for Thursday on a Tuesday. The day
// picker simply does not offer the rest of the week.
//
// DURATION COMES FROM THE PLAN AND IS EDITABLE. "~60 min" on the card becomes
// 60 in the box, because the overwhelmingly common case is that she did roughly
// what she planned - and the overwhelmingly common case should be one tap.
//
// NO EFFORT, NO INTENSITY, NO SCORE. The Activity tab's own sheet asks for
// effort because somebody logging a run from scratch has told the app nothing.
// Here the plan has already said what this is. Asking again would be the app
// making her account for herself.

/** "~60 min", "1.5 hrs", "5-10 min" -> minutes, or null when it does not say. */
export function minutesFromPlan(duration: string | null): number | null {
  if (!duration) return null;
  const d = duration.toLowerCase();
  const hrs = /(\d+(?:\.\d+)?)\s*(?:hr|hour)/.exec(d);
  if (hrs) return Math.round(Number(hrs[1]) * 60);
  // A range takes its lower end: "5-10 min" pre-fills 5, because guessing high
  // would put a number she did not do into her record.
  const mins = /(\d+)(?:\s*[-–]\s*\d+)?\s*(?:min|minute)/.exec(d);
  if (mins) return Number(mins[1]);
  return null;
}

export type PlanToLog = {
  id: string;
  activity: string;
  duration: string | null;
  /** The days it sits on now, so "Move to…" can show what is already true. */
  days: string[];
};

// MOUNTED ONLY WHILE IT IS OPEN, so every field can be initialised from the
// plan at first render. The first version kept it mounted and reset the fields
// in an effect, which the React Compiler lint correctly refuses: state written
// from an effect is a second render nobody asked for, and it is also how a
// sheet ends up briefly showing the PREVIOUS activity's duration.
export function LogPlanSheet({
  plan,
  onClose,
  onLog,
  onMove,
  onRemove,
}: {
  plan: PlanToLog;
  onClose: () => void;
  onLog: (input: { activity: string; when: Date; minutes: number | null; note: string }) => Promise<void>;
  /** Take it out of her week entirely. See removeFromWeek for why not "delete". */
  onRemove?: () => void;
  /**
   * MOVE TO… LIVES HERE (Ruth, 29 September 2026: "in the tap sheet for any
   * activity card, a way to choose a day (Mon-Sun) or Anytime. Keep it
   * permanently alongside drag; it's also the accessible route, since screen
   * reader users can't drag.")
   *
   * The tap sheet is the right home for it because a tap is the one way into
   * a card that every user has - with TalkBack on, with one hand, with a
   * tremor. The drag is the shortcut; this is the road.
   */
  onMove?: () => void;
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
  const [when, setWhen] = useState<Date>(() => new Date());
  const [minutes, setMinutes] = useState(() => {
    const m = minutesFromPlan(plan.duration);
    return m == null ? '' : String(m);
  });
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  // Two taps to remove. See the control at the bottom of the sheet.
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [failed, setFailed] = useState(false);

  // THIS WEEK, UP TO AND INCLUDING TODAY. Not the whole week, for the reason in
  // the header: the rest of it has not happened.
  const today = new Date();
  const days = daysOfWeek(currentWeekStart(today)).filter(
    (d) => d.getTime() <= new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  );

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  async function submit() {
    if (saving) return;
    setSaving(true);
    setFailed(false);
    try {
      const n = minutes.trim() ? Number(minutes.replace(/[^0-9]/g, '')) : null;
      await onLog({
        activity: plan.activity,
        when,
        minutes: n && n > 0 ? n : null,
        note: note.trim(),
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
        <ThemedView style={[styles.sheet, { paddingBottom: insets.bottom + TAB_CLEARANCE }]}>
          <View style={[styles.grabber, { backgroundColor: theme.backgroundSelected }]} />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <ThemedText type="sectionTitle">Log {plan.activity}</ThemedText>

            <ThemedText type="small" themeColor="textSecondary">
              Day
            </ThemedText>
            <View style={styles.dayRow}>
              {days.map((d) => {
                const on = sameDay(d, when);
                const isToday = sameDay(d, today);
                return (
                  <Pressable
                    key={d.toISOString()}
                    onPress={() => setWhen(d)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${DAY_LABEL[dayKeyOf(d)]} ${shortDate(d)}${isToday ? ', today' : ''}`}
                    style={({ pressed }) => pressed && styles.pressed}>
                    <ThemedView
                      type={on ? 'backgroundSelected' : 'backgroundElement'}
                      style={[styles.dayChip, { borderColor: on ? theme.accentDeep : 'transparent' }]}>
                      <ThemedText type="small" themeColor={on ? 'accentDeep' : 'text'}>
                        {isToday ? 'Today' : DAY_LABEL[dayKeyOf(d)]}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {shortDate(d)}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                );
              })}
            </View>

            <ThemedText type="small" themeColor="textSecondary">
              Duration
            </ThemedText>
            <View style={styles.durationRow}>
              <TextInput
                value={minutes}
                onChangeText={setMinutes}
                keyboardType="numeric"
                placeholder="Minutes"
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Duration in minutes"
                style={[styles.input, styles.minutes, { color: theme.text, borderColor: theme.backgroundSelected }]}
              />
              <ThemedText type="small" themeColor="textSecondary">
                minutes
              </ThemedText>
            </View>

            <ThemedText type="small" themeColor="textSecondary">
              Note (optional)
            </ThemedText>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="How did it feel? Any notes?"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="An optional note"
              style={[styles.input, styles.note, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />

            {failed && (
              <ThemedText type="small" themeColor="danger">
                That didn&apos;t save. Check your connection and try again.
              </ThemedText>
            )}

          </ScrollView>

          {/* THE BUTTON IS OUTSIDE THE SCROLLER, which is the standard shape
              for a bottom sheet and the end of a whole class of problem.
              Inside it, the button's visibility depended on the content height,
              the sheet's maxHeight and the tab bar all agreeing - and three
              attempts at padding moved it from half-hidden to entirely hidden
              to off the bottom of the scroll. Pinned, it is simply always
              there, and the fields scroll behind it. */}
          <View style={styles.footer}>
            {/* ABOVE THE BUTTON AND OUTSIDE THE SCROLLER, so it is on screen
                the moment the sheet opens. It was the last thing in the
                scrolling body, which put it below the fold - and a route that
                has to be scrolled to is not the accessible route she asked
                for, it is a second hidden gesture. */}
            {onMove && (
              <Pressable
                onPress={onMove}
                accessibilityRole="button"
                accessibilityLabel={`Move ${plan.activity} to another day`}
                accessibilityHint="Opens a list of days, and Anytime this week"
                hitSlop={Spacing.two}
                style={({ pressed }) => [styles.moveRow, pressed && styles.pressed]}>
                <ThemedText type="small" themeColor="accentDeep">
                  Move to…
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {plan.days.length === 0
                    ? 'Anytime this week'
                    : plan.days.map((d) => DAY_LABEL[d as DayKey] ?? d).join(', ')}
                </ThemedText>
              </Pressable>
            )}
            <Pressable
              onPress={() => void submit()}
              accessibilityRole="button"
              accessibilityState={{ disabled: saving }}
              style={({ pressed }) => pressed && styles.pressed}>
              <View style={[styles.cta, { backgroundColor: theme.accentDeep }]}>
                <ThemedText type="smallBold" themeColor="background">
                  {saving ? 'Logging…' : 'Log it'}
                </ThemedText>
              </View>
            </Pressable>

            {/* LAST AND QUIET, the same shape as removing a food entry: the one
                thing on this sheet that takes something away rather than adding
                to it, so it sits under the action she actually came for.

                TWO TAPS, NOT ONE. The second tap is the confirmation, in place,
                rather than a dialog - which is the pattern swipe-to-delete
                already settled on ("the gesture uncovers a delete, and the
                delete is a tap. That IS the confirmation her spec asks for").
                A plan is not precious, but a sheet she opened to LOG something
                should not lose her week's shape to a misplaced thumb. */}
            {onRemove && (
              <Pressable
                onPress={() => (confirmRemove ? onRemove() : setConfirmRemove(true))}
                accessibilityRole="button"
                accessibilityLabel={
                  confirmRemove
                    ? `Confirm, take ${plan.activity} out of my week`
                    : `Take ${plan.activity} out of my week`
                }
                hitSlop={Spacing.two}
                style={({ pressed }) => [styles.removeRow, pressed && styles.pressed]}>
                <ThemedText type="small" themeColor={confirmRemove ? 'accentDeep' : 'textSecondary'}>
                  {confirmRemove ? 'Tap again to take it out' : 'Take out of my week'}
                </ThemedText>
              </Pressable>
            )}
          </View>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(23, 13, 9, 0.35)' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
  },
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
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  dayChip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: CardRadius,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  input: {
    borderWidth: 1,
    borderRadius: CardRadius,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  minutes: { width: 120 },
  note: { minHeight: 88, textAlignVertical: 'top' },
  removeRow: {
    alignSelf: 'center',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    // 44 tall, because it is a control.
    minHeight: 44,
  },
  footer: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  cta: {
    paddingVertical: Spacing.three,
    borderRadius: 999,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
});
