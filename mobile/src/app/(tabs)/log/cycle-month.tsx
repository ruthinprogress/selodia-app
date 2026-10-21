import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BodyScreen } from '@/components/body-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Chips } from '@/components/cycle-cards';
import { cycleMonths, endDayOptions, monthTitles } from '@/lib/cycle-months';
import {
  dayLine,
  dayOfCycle,
  monthSummary,
  shortDay,
  type DayRow,
} from '@/lib/cycle-month-detail';
import { currentUserId } from '@/lib/current-user';
import { human } from '@/lib/day-names';
import { today } from '@/lib/day-names';
import { supabase } from '@/lib/supabase';

// ONE CYCLE, OPENED - SCREENS 2 AND 3 OF HER ARTWORK (21 October 2026).
//
// The summary card is always there; the daily log underneath folds away, and
// starts folded. Her drawing has it that way round for a reason worth keeping:
// the card answers what the cycle WAS, which is what she came for, and the
// list answers what she did on each day of it, which is what she came for
// occasionally. A screen that opens on a list of thirty rows answers neither.
//
// EVERY NUMBER ON THE CARD IS COUNTED FROM HER ROWS. Nothing is averaged in and
// nothing is filled from a typical cycle - see cycle-month-detail.ts.

export default function CycleMonthScreen() {
  const theme = useTheme();
  const { start } = useLocalSearchParams<{ start?: string }>();
  const [events, setEvents] = useState<{ event_date: string; event_type: string }[]>([]);
  const [days, setDays] = useState<DayRow[]>([]);
  const [open, setOpen] = useState(false);
  // THE TWO THINGS THIS SCREEN COULD NOT DO (Ruth, 21 October 2026): "Delete
  // this entry. It was a test. Theres no way to delete it at all in the app."
  // And: "there is no way to say when the period in September ended."
  const [ending, setEnding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const userId = await currentUserId();
        if (!userId || !start || cancelled) return;
        const { data: ev } = await supabase
          .from('cycle_events')
          .select('event_date, event_type')
          .eq('user_id', userId);
        if (cancelled) return;
        setEvents(ev ?? []);

        // THE DAYS OF THIS CYCLE ONLY, bounded by the next start. An unbounded
        // read would put another month's days under this month's heading.
        const starts = (ev ?? [])
          .filter((e) => e.event_type === 'period_start')
          .map((e) => e.event_date)
          .sort();
        const after = starts.find((s) => s > start) ?? null;
        let q = supabase
          .from('daily_observations')
          .select('day, flow, symptoms, mucus, notes')
          .eq('user_id', userId)
          .gte('day', start)
          .order('day', { ascending: false });
        q = after ? q.lt('day', after) : q.lte('day', today());
        const { data: obs } = await q;
        if (!cancelled) setDays((obs ?? []) as DayRow[]);
      })();
      return () => {
        cancelled = true;
      };
    }, [start])
  );

  async function recordEnd(on: string) {
    if (busy || !start) return;
    setBusy(true);
    try {
      const userId = await currentUserId();
      if (!userId) return;
      const { error } = await supabase
        .from('cycle_events')
        .upsert(
          { user_id: userId, event_date: on, event_type: 'period_end' },
          { onConflict: 'user_id,event_date,event_type' }
        );
      if (error) {
        setNote('That did not save. Worth trying again.');
        return;
      }
      setEvents((e) => [...e, { event_date: on, event_type: 'period_end' }]);
      setEnding(false);
      setNote(null);
    } finally {
      setBusy(false);
    }
  }

  /**
   * REMOVING A CYCLE REMOVES THE WHOLE CYCLE, start and end together.
   *
   * Leaving a stray end behind would attach it to the cycle BEFORE this one -
   * bleedLength bounds an end by the next start, and with this start gone the
   * previous one reaches straight through it. The row she deleted would come
   * back as a wrong bleed length on a row she did not touch.
   *
   * WHAT IT DOES NOT TOUCH is anything she logged on those days. Symptoms, flow
   * and notes are observations about a date and belong to her, not to the cycle
   * that happened to contain them - see the note in cycle-day.tsx about a
   * symptom being just a symptom.
   */
  async function deleteCycle() {
    if (busy || !start) return;
    setBusy(true);
    try {
      const userId = await currentUserId();
      if (!userId) return;
      let ends = supabase
        .from('cycle_events')
        .delete()
        .eq('user_id', userId)
        .eq('event_type', 'period_end')
        .gte('event_date', start);
      if (nextStart) ends = ends.lt('event_date', nextStart);
      await ends;
      const { error } = await supabase
        .from('cycle_events')
        .delete()
        .eq('user_id', userId)
        .eq('event_type', 'period_start')
        .eq('event_date', start);
      if (error) {
        setNote('That did not delete. Worth trying again.');
        return;
      }
      router.back();
    } finally {
      setBusy(false);
    }
  }

  const rows = useMemo(() => cycleMonths(events, today()), [events]);
  const titles = useMemo(() => monthTitles(rows), [rows]);
  const index = rows.findIndex((r) => r.start === start);
  const row = index >= 0 ? rows[index] : null;
  // The list is newest first, so the NEXT cycle chronologically is the one above.
  const nextStart = index > 0 ? rows[index - 1].start : null;
  const summary = useMemo(
    () => (row ? monthSummary(row, events, nextStart, days) : null),
    [row, events, nextStart, days]
  );

  const heading = row ? `${titles[index]} ${row.year}` : 'Cycle';

  if (!row || !summary) {
    return (
      <BodyScreen title="Cycle">
        <ThemedText type="small" themeColor="textSecondary">
          That cycle could not be found.
        </ThemedText>
      </BodyScreen>
    );
  }

  return (
    <BodyScreen title={heading}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">
          {summary.lengthLabel ?? `Started ${shortDay(row.start)}`}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {summary.bleedLabel ?? (row.ongoing ? 'Still going' : 'End not logged')}
        </ThemedText>

        <View style={styles.facts}>
          <View style={styles.fact}>
            <ThemedText type="detail" themeColor="textSecondary">
              Period
            </ThemedText>
            <ThemedText type="small">{summary.periodLabel}</ThemedText>
          </View>
          <View style={styles.fact}>
            <ThemedText type="detail" themeColor="textSecondary">
              Logged on
            </ThemedText>
            <ThemedText type="small">
              {summary.loggedDays} {summary.loggedDays === 1 ? 'day' : 'days'}
            </ThemedText>
          </View>
        </View>

        {summary.common.length > 0 && (
          <>
            <ThemedText type="detail" themeColor="textSecondary" style={styles.commonHead}>
              Most common symptoms
            </ThemedText>
            <View style={styles.chips}>
              {summary.common.map((c) => (
                <ThemedView key={c.name} type="background" style={styles.chip}>
                  <ThemedText type="detail">
                    {c.name} ({c.count})
                  </ThemedText>
                </ThemedView>
              ))}
            </View>
          </>
        )}
      </ThemedView>

      {/* WHAT SHE CAN DO TO THIS CYCLE. Both of these were missing entirely
          (Ruth, 21 October 2026): "Theres no way to delete it at all in the
          app", and "there is no way to say when the period in September
          ended."

          THE END WAS REACHABLE ONLY WHILE IT WAS RECENT. The Cycle screen's own
          action offers the last fourteen days from TODAY, so a September period
          could be closed in September and never afterwards - while the row went
          on printing "End not logged" with no way to answer it. Here the days
          are offered relative to the period itself. */}
      <View style={styles.actions}>
        {!row.ongoing && summary.bleedLabel == null && (
          <>
            <Pressable
              onPress={() => setEnding((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Say when this period ended"
              hitSlop={Spacing.two}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedText type="small" themeColor="link">
                Say when this period ended
              </ThemedText>
            </Pressable>
            {ending && (
              <Chips
                options={endDayOptions(row.start, nextStart, today()).map(human)}
                selected={[]}
                single
                onToggle={(label) => {
                  const d = endDayOptions(row.start, nextStart, today()).find((x) => human(x) === label);
                  if (d) void recordEnd(d);
                }}
              />
            )}
          </>
        )}

        {/* DELETING ASKS FIRST, and says what goes. A period start is the spine
            of the record: remove it and the cycle before it grows to swallow
            this one, which is a change to a row she did not touch. */}
        {confirming ? (
          <View style={styles.confirm}>
            <ThemedText type="small">
              Delete this cycle? The start{summary.bleedLabel ? ' and its end' : ''} will go, and{' '}
              {nextStart ? 'the cycle before it will run on to the next one' : 'the one before it becomes the current cycle'}.
              Anything logged on these days stays.
            </ThemedText>
            <View style={styles.confirmRow}>
              <Pressable
                onPress={() => void deleteCycle()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Yes, delete this cycle"
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedView style={[styles.danger, { backgroundColor: theme.danger }]}>
                  <ThemedText type="smallBold" themeColor="background">
                    {busy ? 'Deleting…' : 'Delete it'}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => setConfirming(false)}
                accessibilityRole="button"
                accessibilityLabel="Keep this cycle"
                hitSlop={Spacing.two}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedText type="small" themeColor="link">
                  Keep it
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setConfirming(true)}
            accessibilityRole="button"
            accessibilityLabel="Delete this cycle"
            hitSlop={Spacing.two}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedText type="small" themeColor="textSecondary">
              Delete this cycle
            </ThemedText>
          </Pressable>
        )}

        {note && (
          <ThemedText type="detail" themeColor="textSecondary">
            {note}
          </ThemedText>
        )}
      </View>

      {/* THE DAILY LOG, FOLDED. Her drawing shows it shut on arrival and open
          on a tap, with the chevron saying which way it goes. */}
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Daily log' : 'View daily log'}
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.foldBar, pressed && styles.pressed]}
      >
        <ThemedText type="smallBold" style={styles.foldText}>
          {open ? 'Daily log' : 'View daily log'}
        </ThemedText>
        {/* HER RULE, NOT THE DRAWING'S (14 October 2026): "The need to point to
            the header and then point down when open." The artwork draws this
            fold with down-then-up, which is the convention she had already
            ruled against on the Me tab - on one screen a down arrow then means
            "closed" in one place and "open" in another. */}
        {/* Ionicons, because the two names the rule is written in are its own:
            chevron-forward and chevron-down. */}
        <Ionicons
          name={open ? 'chevron-down' : 'chevron-forward'}
          size={18}
          color={theme.textSecondary}
        />
      </Pressable>

      {open &&
        (days.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.none}>
            Nothing was logged during this cycle.
          </ThemedText>
        ) : (
          days.map((d) => {
            const n = dayOfCycle(row.start, d.day);
            const line = dayLine(d);
            return (
              <Pressable
                key={d.day}
                onPress={() => router.push({ pathname: '/log/cycle-day', params: { day: d.day } })}
                accessibilityRole="button"
                accessibilityLabel={`${shortDay(d.day)}${n ? `, day ${n} of the cycle` : ''}. ${line || 'Nothing recorded'}.`}
                accessibilityHint="Opens this day"
                style={({ pressed }) => pressed && styles.pressed}
              >
                <View style={[styles.dayRow, { borderBottomColor: theme.backgroundElement }]}>
                  <MaterialCommunityIcons
                    name="water"
                    size={18}
                    // THE DROP IS THE FLOW. A day with no flow logged gets the
                    // palest one rather than none, so the column stays a column.
                    color={
                      d.flow === 'heavy'
                        ? theme.accentDeep
                        : d.flow === 'medium'
                          ? theme.accent
                          : d.flow
                            ? theme.accentWash
                            : theme.backgroundElement
                    }
                  />
                  <ThemedText type="detail" themeColor="textSecondary" style={styles.dayDate}>
                    {shortDay(d.day)}
                  </ThemedText>
                  <View style={styles.dayText}>
                    {n != null && <ThemedText type="small">Day {n}</ThemedText>}
                    {line.length > 0 && (
                      <ThemedText type="detail" themeColor="textSecondary">
                        {line}
                      </ThemedText>
                    )}
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
                </View>
              </Pressable>
            );
          })
        ))}
    </BodyScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4, padding: Spacing.four, borderRadius: CardRadius, marginBottom: Spacing.four },
  facts: { flexDirection: 'row', gap: Spacing.five, marginTop: Spacing.three },
  fact: { gap: 2 },
  commonHead: { marginTop: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.two },
  chip: { paddingVertical: 6, paddingHorizontal: Spacing.three, borderRadius: Spacing.four },
  actions: { gap: Spacing.two, alignItems: 'flex-start', marginBottom: Spacing.three },
  confirm: { gap: Spacing.two },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  danger: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.four, borderRadius: Spacing.four, minHeight: 44, justifyContent: 'center' },
  foldBar: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: Spacing.two },
  // FILLS THE BAR rather than hugging its own measured width - the one word
  // that took four attempts to find on the segmented tabs.
  foldText: { flex: 1 },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    minHeight: 44,
  },
  dayDate: { width: 52 },
  dayText: { flex: 1, gap: 2 },
  none: { lineHeight: 20, paddingVertical: Spacing.three },
  pressed: { opacity: 0.6 },
});
