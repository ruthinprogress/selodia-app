import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SwipeToDelete } from '@/components/swipe-to-delete';
import { ThemedText } from '@/components/themed-text';
import { sentenceStart } from '@/lib/sentence-start';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  cancelEventReminder,
  deleteEvent,
  restoreEventReminder,
  eventDateLabel,
  eventTimeLabel,
  loadUpcoming,
  type CalendarEvent,
} from '@/lib/calendar';

// WHAT IS COMING UP, WHICH THE WEEK DELIBERATELY CANNOT HOLD.
//
// Ruth, 18 October 2026: "Week is a template of your week, it's not a real
// week... It's not for one-off appointments. If it was a one-off appointment,
// they would ask in chat to add something to their calendar." It was not built.
// "we need to build calendar also then."
//
// IT LIVES ON NOW, not in a sixth tab. Now is already the screen you open to
// see where you are, it already wears the calendar icon in the tab bar, and it
// is already built out of folding sections. An appointment on Thursday is
// exactly the kind of thing that belongs beside today's date.
//
// NOTHING IS ADDED FROM HERE, AND THAT IS ON PURPOSE FOR NOW. Her own route
// was "they would ask in chat to add something to their calendar", and chat
// does it: date, time, where, what to bring, and a reminder before it. A form
// here would be a second way of saying the same thing, and the gap worth
// closing first was seeing what you had told it.

export function DiarySection({ reloadKey }: { reloadKey?: number }) {
  const theme = useTheme();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [open, setOpen] = useState<CalendarEvent | null>(null);

  const load = useCallback(async () => {
    setEvents(await loadUpcoming());
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  return (
    <>
      {events.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {/* NOT "NOTHING HERE". The empty state says how one gets here, because
              the only way in is chat and nobody would guess that from a list. */}
          Nothing coming up. Tell me about an appointment in chat and it will land here, with
          where it is and what to bring.
        </ThemedText>
      ) : (
        <View style={styles.list}>
          {events.map((e) => {
            const time = eventTimeLabel(e.event_time);
            const reminds = Boolean(e.remind_at && !e.reminder_cancelled_at);
            // WHAT A SWIPE CAN DO HERE (Ruth, 21 October 2026): "I want all
            // pills like this to slide to delete. I wonder if the same could be
            // said for turning off the reminder... most people know this."
            //
            // The same gesture the Log and the Me tab already use, so the
            // reveal, the catch distance and the one-open-at-a-time rule are
            // one behaviour rather than a second copy of it.
            //
            // THE BELL ONLY APPEARS WHEN THERE IS ONE. An entry with no
            // reminder has nothing to switch, and a struck-through bell on it
            // would offer something that cannot happen.
            const hasReminder = Boolean(e.remind_at);
            return (
              <SwipeToDelete
                key={e.id}
                what={sentenceStart(e.title)}
                onDelete={() => deleteEvent(e.id)}
                onDeleted={() => void load()}
                onSecond={
                  hasReminder
                    ? async () => {
                        await (reminds ? cancelEventReminder(e.id) : restoreEventReminder(e.id));
                        void load();
                      }
                    : undefined
                }
                secondLabel={reminds ? 'Reminder off' : 'Reminder on'}
                secondIcon={reminds ? 'notifications-off-outline' : 'notifications-outline'}
              >
              <Pressable
                onPress={() => setOpen(e)}
                accessibilityRole="button"
                accessibilityLabel={`${sentenceStart(e.title)}, ${eventDateLabel(e.event_date)}${
                  time ? ` at ${time}` : ''
                }${reminds ? ', reminder set' : ''}`}
                accessibilityHint="Opens it, with where it is and what to bring"
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.row}>
                  <View style={styles.rowTop}>
                    <ThemedText type="smallBold" style={styles.title}>
                      {sentenceStart(e.title)}
                    </ThemedText>
                    {/* THE TIME, OR NOTHING AT ALL. A date with no hour is the
                        normal state of a hospital letter, and an invented 9am
                        would look like information. */}
                    {time ? <ThemedText type="small">{time}</ThemedText> : null}
                    {/* AND THE ARROW, BECAUSE THERE IS A ROUTE (Ruth, 21
                        October 2026): "still arrow if there's a route."

                        There is: the card opens its own detail, with where it
                        is and what to bring. What there is NOT is a link back
                        to the conversation it came from - a diary entry
                        records no thread - so this points at the detail and
                        claims nothing else. */}
                    <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {[eventDateLabel(e.event_date), e.place].filter(Boolean).join(' · ')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              </SwipeToDelete>
            );
          })}
        </View>
      )}

      {open && (
        <EventSheet
          event={open}
          onClose={() => setOpen(null)}
          onChanged={() => {
            setOpen(null);
            void load();
          }}
        />
      )}
    </>
  );
}

/** One appointment, with the two things that can be done to it. */
function EventSheet({
  event,
  onClose,
  onChanged,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onChanged: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const clearance = BottomTabInset || 80;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [failed, setFailed] = useState(false);

  const time = eventTimeLabel(event.event_time);
  const reminds = Boolean(event.remind_at && !event.reminder_cancelled_at);

  async function run(fn: () => Promise<void>) {
    setFailed(false);
    try {
      await fn();
      onChanged();
    } catch {
      setFailed(true);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <ThemedView style={[styles.sheet, { paddingBottom: insets.bottom + clearance }]}>
        <View style={[styles.grabber, { backgroundColor: theme.backgroundSelected }]} />
        <View style={styles.body}>
          <ThemedText type="sectionTitle">{sentenceStart(event.title)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {[eventDateLabel(event.event_date), time].filter(Boolean).join(' · ')}
          </ThemedText>

          {event.place ? <Detail label="Where" value={event.place} /> : null}
          {/* WHAT TO BRING IS THE WHOLE POINT OF THIS SCREEN EXISTING.
              health-support.ts named the four things somebody needs in their
              hand at the door - date, time, address, what to bring - as the
              reason an appointments table was wanted at all. */}
          {event.what_to_bring ? <Detail label="Bring" value={event.what_to_bring} /> : null}
          {event.notes ? <Detail label="Notes" value={event.notes} /> : null}

          {reminds ? (
            <Pressable
              onPress={() => void run(() => cancelEventReminder(event.id))}
              accessibilityRole="button"
              accessibilityLabel={`Stop reminding me about ${event.title}`}
              hitSlop={Spacing.two}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <ThemedText type="small" themeColor="accentDeep">
                Stop the reminder
              </ThemedText>
            </Pressable>
          ) : null}

          {failed ? (
            <ThemedText type="small" themeColor="accentDeep">
              That did not go through. Check your connection and try again.
            </ThemedText>
          ) : null}

          {/* TWO TAPS, the same shape as removing a food entry. And it says
              DELETE, because that is what it is: an appointment has no Anytime
              to fall into, a date is the only place it could sit. */}
          <Pressable
            onPress={() =>
              confirmDelete ? void run(() => deleteEvent(event.id)) : setConfirmDelete(true)
            }
            accessibilityRole="button"
            accessibilityLabel={
              confirmDelete ? `Confirm, delete ${event.title}` : `Delete ${event.title}`
            }
            hitSlop={Spacing.two}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
            <ThemedText type="small" themeColor={confirmDelete ? 'accentDeep' : 'textSecondary'}>
              {confirmDelete ? 'Tap again to delete it' : 'Delete'}
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create<{
  list: ViewStyle;
  row: ViewStyle;
  rowTop: ViewStyle;
  title: TextStyle;
  scrim: ViewStyle;
  sheet: ViewStyle;
  grabber: ViewStyle;
  body: ViewStyle;
  detail: ViewStyle;
  action: ViewStyle;
  pressed: ViewStyle;
}>({
  list: { gap: Spacing.two },
  row: { borderRadius: CardRadius, padding: Spacing.three, gap: Spacing.one },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  // min-width 0 so a long appointment name wraps instead of pushing the time
  // off the edge of the card.
  title: { flexShrink: 1, minWidth: 0 },
  scrim: { flex: 1, backgroundColor: 'rgba(23, 13, 9, 0.35)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' },
  grabber: { width: 44, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.three },
  body: { padding: Spacing.four, gap: Spacing.two },
  detail: { gap: 2 },
  action: { minHeight: 44, justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
