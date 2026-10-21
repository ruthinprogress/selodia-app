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
import { cycleMonths, monthTitles } from '@/lib/cycle-months';
import {
  dayLine,
  dayOfCycle,
  monthSummary,
  shortDay,
  type DayRow,
} from '@/lib/cycle-month-detail';
import { currentUserId } from '@/lib/current-user';
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
