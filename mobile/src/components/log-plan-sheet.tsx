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
  /** The days it sits on now, so "Copy to another day" shows what is already true. */
  days: string[];
  /**
   * WHICH DAY SHE TAPPED IT ON, or null for an Anytime card.
   *
   * Ruth, 18 October 2026: "I duplicated ballet and then selected 'remove from
   * week' and it deleted both."
   *
   * One card on Monday and Thursday is ONE ROW with two days, not two rows -
   * so "take it out" had no way to mean "off Monday". It cleared the whole
   * `days` array and both chips vanished at once, which is indistinguishable
   * from deleting the thing twice.
   *
   * The sheet was opened from a specific day and that was the missing fact.
   * With it, taking it out means taking it off THAT day; the last day dropping
   * it into Anytime falls out for free, because Anytime is defined as whatever
   * is not on a day.
   */
  fromDay: DayKey | null;
  /**
   * THE TIME THE PLAN ITSELF SAYS, in minutes from midnight, or null.
   *
   * Ruth, 18 October 2026, having logged a 19:30 ballet class: "it said 12:00
   * instead of 7.30."
   *
   * The log was stored at noon, and noon was chosen for a good reason - a log
   * at midnight lands on the previous day for anyone behind UTC. But it was
   * being used for every log from this sheet, including ones whose card says
   * 19:30 on the face of it. The app knew the time and stored a different one.
   *
   * ONLY SET FOR A REAL CLOCK TIME. day-time.ts gives "evening" a nominal
   * sorting bucket, and that bucket must never become a logged time: it is
   * there so the week can be ordered, not because anybody said half six. That
   * file puts it plainly - inventing a clock she never said and showing it back
   * to her is the app putting words in her mouth.
   */
  plannedMinutes: number | null;
  /** Her words for when and how long, so the settings sheet can edit them. */
  timeOfDay: string | null;
  /** The reminder as stored, so the sheet opens showing what is already true. */
  remindAt: string | null;
  remindOffsetMinutes: number | null;
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
  onEdit,
}: {
  plan: PlanToLog;
  onClose: () => void;
  onLog: (input: {
    activity: string;
    when: Date;
    minutes: number | null;
    note: string;
    /** The plan's own clock time, so the log is stored at it. See PlanToLog. */
    plannedMinutes: number | null;
  }) => Promise<void>;
  /**
   * Clears its days so it drops into Anytime. NOT a delete: Ruth, 18 October
   * 2026, "it should go into Anytime. If they want to delete it they can do it
   * from there." It used to call removeFromWeek, which destroyed the card.
   */
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
  /**
   * TIME, HOW LONG, AND THE REMINDER (Ruth, 18 October 2026: "I cant find how
   * to set the reminder alarm/notification for the activity card", "There is
   * no way to edit the start time or duration time").
   *
   * It lives on the tap sheet for the same reason "Move to…" was put here: a
   * tap is the one way into a card that every user has, with TalkBack on, with
   * one hand, on a bus.
   */
  onEdit?: () => void;
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

  // WHAT THE REMOVE CONTROL HONESTLY DOES, which depends entirely on where she
  // opened the sheet from. Three different acts wore one label until now, and
  // the widest of them was a delete.
  //
  //   on a day, also on others   takes it off THAT day and leaves the rest
  //   on a day, its only one     clears the last day, so it falls to Anytime
  //   in Anytime                 already out of the week; this is the delete
  //
  // The third is the deletion route Ruth asked for twice ("If they want to
  // delete it they can do it from there"). Swiping an Anytime card is still to
  // come; until it does, this is how a card can be got rid of at all.
  const onLastDay = plan.fromDay != null && plan.days.length <= 1;
  const removeLabel =
    plan.fromDay == null
      ? `Delete ${plan.activity}`
      : onLastDay
        ? 'Take out of my week'
        : `Take out of ${DAY_LABEL[plan.fromDay]}`;
  const removeConfirm =
    plan.fromDay == null
      ? 'Tap again to delete it'
      : onLastDay
        ? 'Tap again to move it to Anytime'
        : `Tap again to take it off ${DAY_LABEL[plan.fromDay]}`;
  const removeHint =
    plan.fromDay == null
      ? 'Removes it for good, including its reminder'
      : onLastDay
        ? 'Moves it to Anytime this week. It is not deleted'
        : 'Leaves it on the other days it is on';

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
        plannedMinutes: plan.plannedMinutes,
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
                accessibilityLabel={`Copy ${plan.activity} to another day`}
                accessibilityHint="Opens the days it happens on. Adding a day keeps the ones it is already on"
                hitSlop={Spacing.two}
                style={({ pressed }) => [styles.moveRow, pressed && styles.pressed]}>
                {/* IT HAS NEVER MOVED ANYTHING (Ruth, 18 October 2026: "It
                    still says 'Move to' which is incorrect. It should say
                    'Copy to another day'").

                    Third time this one label has been wrong, and the same way
                    each time: it opens a sheet whose day chips ADD a day and
                    keep the days already there. The sheet's own title was
                    corrected this morning; the button that opens it still said
                    the old thing, which is how the feature stayed hidden even
                    after the fix. A label is not fixed until every door into
                    the room says the same thing. */}
                <ThemedText type="small" themeColor="accentDeep">
                  Copy to another day
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {plan.days.length === 0
                    ? 'Anytime this week'
                    : plan.days.map((d) => DAY_LABEL[d as DayKey] ?? d).join(', ')}
                </ThemedText>
              </Pressable>
            )}
            {onEdit && (
              <Pressable
                onPress={onEdit}
                accessibilityRole="button"
                accessibilityLabel={`Change the time, length and reminder for ${plan.activity}`}
                accessibilityHint="Opens when it happens, how long it takes, and whether it reminds you"
                hitSlop={Spacing.two}
                style={({ pressed }) => [styles.moveRow, pressed && styles.pressed]}>
                <ThemedText type="small" themeColor="accentDeep">
                  Time, length and reminder
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {plan.remindAt ? 'Reminder on' : 'No reminder'}
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
                  confirmRemove ? `Confirm, ${removeLabel.toLowerCase()}` : removeLabel
                }
                accessibilityHint={removeHint}
                hitSlop={Spacing.two}
                style={({ pressed }) => [styles.removeRow, pressed && styles.pressed]}>
                <ThemedText
                  type="small"
                  themeColor={confirmRemove ? 'accentDeep' : 'textSecondary'}
                  numberOfLines={1}
                  style={styles.removeLabel}
                >
                  {confirmRemove ? removeConfirm : removeLabel}
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
    // FULL WIDTH, CENTRED TEXT, rather than a centred box that shrinks to its
    // content. Ruth's screen read "Take out of my": the box took its width from
    // the text, wrapped, and the second line was cut. A row that owns the full
    // width cannot wrap a line this short.
    alignSelf: 'stretch',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  removeLabel: {
    textAlign: 'center',
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
