import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BodyScreen } from '@/components/body-screen';
import { Chips } from '@/components/cycle-cards';
import { CycleMonthRow } from '@/components/cycle-month-rows';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { bleedState, CHOOSABLE_DAYS, lastBleedLength, recentDays } from '@/lib/period-row';
import { byYear, cycleMonths, cyclePattern, monthTitles } from '@/lib/cycle-months';
import { expectedNextPeriod, knowledgeFrom } from '@/lib/cycle-history';
import { currentUserId } from '@/lib/current-user';
import { human, today } from '@/lib/day-names';
import { supabase } from '@/lib/supabase';

// THE CYCLE SCREEN IS THE HISTORY SCREEN - AND NOW IT READS LIKE ONE.
//
// Build spec, 9 October 2026: "What remains is the period action and the
// history... the state-aware period row, the 'anything today?' row, the summary
// card, and the bars." That was right about what belongs here and said nothing
// about how to read it, so what shipped was a button, a door and a row of bars.
// It RECORDED a cycle; it could not be READ.
//
// Ruth's artwork, 21 October 2026, eight screens: her months newest first, each
// opening onto a summary of that cycle, each day of it opening onto what she
// logged. Screen 1 is this one - a pattern card, a year, and one row per cycle.
//
// WHERE THE PERIOD BUTTON WENT, and this is a deviation from the drawing worth
// naming. The artwork shows no period start or end anywhere, because its
// logging journey lives on the Log tab. But the end button exists because she
// found its absence herself - "There is something missing, and that's how to
// say when the period ended" - so taking it off the screen on the strength of a
// drawing that was not thinking about it would be undoing her own fix. It is
// here, as one quiet row rather than the card that used to dominate the page.

export default function CycleScreen() {
  const theme = useTheme();
  const [events, setEvents] = useState<{ event_date: string; event_type: string }[]>([]);
  const [choosing, setChoosing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [closed, setClosed] = useState<number | null>(null);

  // ON FOCUS, NOT ON MOUNT. A period said in chat has to show here when she
  // comes back, and a tab mounts once.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const userId = await currentUserId();
        if (!userId || cancelled) return;
        const { data } = await supabase
          .from('cycle_events')
          .select('event_date, event_type')
          .eq('user_id', userId);
        if (!cancelled) setEvents(data ?? []);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  async function mark(type: 'period_start' | 'period_end', on: string) {
    const userId = await currentUserId();
    if (!userId) return;
    // UPSERT, because saying it twice is not two periods. There is a unique
    // index on the day and the kind, so a second press on the same day is a
    // quiet no-op rather than an error reported as a failure to save.
    const { error } = await supabase
      .from('cycle_events')
      .upsert({ user_id: userId, event_date: on, event_type: type }, { onConflict: 'user_id,event_date,event_type' });
    if (error) {
      setNote('That did not save. Worth trying again.');
      return;
    }
    const next = events.some((x) => x.event_date === on && x.event_type === type)
      ? events
      : [...events, { event_date: on, event_type: type }];
    setEvents(next);
    setChoosing(false);
    setNote(null);
    if (type === 'period_end') {
      // THE LENGTH OF THE ONE THAT JUST CLOSED, which is not readable from
      // bleedState - by the time the end is written she is no longer bleeding,
      // so asking it for a day number returns nothing.
      setClosed(lastBleedLength(next));
    } else {
      setClosed(null);
      setNote(`Period start recorded for ${human(on)}.`);
    }
  }

  const knowledge = knowledgeFrom(events);
  const next = expectedNextPeriod(knowledge);
  const bleed = bleedState(events, today());
  const rows = useMemo(() => cycleMonths(events, today()), [events]);
  const titles = useMemo(() => monthTitles(rows), [rows]);
  const years = useMemo(() => byYear(rows), [rows]);
  const pattern = useMemo(() => cyclePattern(events), [events]);
  const titleFor = (start: string) => titles[rows.findIndex((r) => r.start === start)] ?? '';

  const openMonth = (start: string) =>
    router.push({ pathname: '/log/cycle-month', params: { start } });

  return (
    <BodyScreen title="Cycle">
      {/* HER PATTERN, FIRST, because it is the one thing on this screen that is
          about her rather than about a month. Only drawn once her own cycles
          can answer it: an average of one cycle is an anecdote with a number
          on it, and this screen is a record, not a guess. */}
      {pattern ? (
        <ThemedView type="backgroundElement" style={styles.pattern}>
          <ThemedText type="smallBold">Your cycle pattern</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Average {pattern.average} days
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Range {pattern.shortest} – {pattern.longest} days
          </ThemedText>
          {next && (
            <ThemedText type="detail" themeColor="textSecondary" style={styles.spaced}>
              Next one expected around {human(next.on)}
              {next.give > 0 ? `, give or take ${next.give} ${next.give === 1 ? 'day' : 'days'}` : ''}.
            </ThemedText>
          )}
        </ThemedView>
      ) : (
        <ThemedView type="backgroundElement" style={styles.pattern}>
          <ThemedText type="smallBold">Your cycle pattern</ThemedText>
          {/* SAID PLAINLY RATHER THAN LEFT BLANK. An empty card on a screen she
              has just started using reads as broken; this reads as early. */}
          <ThemedText type="small" themeColor="textSecondary">
            {knowledge.lastStart
              ? 'Once a few periods are recorded, your own average and range appear here. One is not enough to say anything useful.'
              : 'Record a period start and this begins to fill in.'}
          </ThemedText>
        </ThemedView>
      )}

      {/* THE ONE ACTION. Shown as what there is to do right now, never both. */}
      <View style={styles.action}>
        {closed !== null ? (
          <Pressable
            onPress={() => setClosed(null)}
            accessibilityRole="button"
            accessibilityLabel="Done"
            hitSlop={Spacing.two}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedText type="small">
              That cycle is closed. {closed} days.{'  '}
              <ThemedText type="small" themeColor="link">
                Done
              </ThemedText>
            </ThemedText>
          </Pressable>
        ) : (
          <>
            {/* WHICH DAY OF THE PERIOD, while there is one. The row above says
                which day of the CYCLE she is on, which is a different number
                and answers a different question - this one is about right now,
                and it is the reason the action underneath says what it says. */}
            {bleed.state === 'bleeding' && (
              <ThemedText type="smallBold">Day {bleed.dayOfPeriod} of your period</ThemedText>
            )}
            <Pressable
              onPress={() =>
                void mark(bleed.state === 'bleeding' ? 'period_end' : 'period_start', today())
              }
              accessibilityRole="button"
              accessibilityLabel={
                bleed.state === 'bleeding'
                  ? 'Record that your period has stopped'
                  : 'Record a period starting today'
              }
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedView style={[styles.button, { backgroundColor: theme.accentDeep }]}>
                <ThemedText type="smallBold" themeColor="background">
                  {bleed.state === 'bleeding' ? "It's stopped" : 'Period started today'}
                </ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable
              onPress={() => setChoosing((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Choose the day"
              hitSlop={Spacing.two}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedText type="small" themeColor="link">
                Choose the day
              </ThemedText>
            </Pressable>
            {/* REMEMBERING TWO DAYS LATE IS THE ORDINARY WAY THIS GETS LOGGED
                (build spec, 9 October), so it is not an edge case behind a menu. */}
            {choosing && (
              <Chips
                options={recentDays(today(), CHOOSABLE_DAYS).map(human)}
                selected={[]}
                single
                onToggle={(label) => {
                  const d = recentDays(today(), CHOOSABLE_DAYS).find((x) => human(x) === label);
                  if (d) void mark(bleed.state === 'bleeding' ? 'period_end' : 'period_start', d);
                }}
              />
            )}
          </>
        )}
        {note && (
          <ThemedText type="detail" themeColor="textSecondary">
            {note}
          </ThemedText>
        )}
      </View>

      {/* THE RECORD. A year, then its cycles, newest first. */}
      {years.map(({ year, months }) => (
        <View key={year} style={styles.year}>
          <ThemedText type="small" themeColor="textSecondary">
            {year}
          </ThemedText>
          {months.map((row) => (
            <CycleMonthRow
              key={row.start}
              row={row}
              title={titleFor(row.start)}
              current={row.ongoing}
              onPress={() => openMonth(row.start)}
            />
          ))}
        </View>
      ))}

      {rows.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
          Nothing recorded yet. Once a period start goes in, your months appear here.
        </ThemedText>
      )}

      <Pressable
        onPress={() => router.push({ pathname: '/log/cycle-day', params: { day: today() } })}
        accessibilityRole="button"
        accessibilityLabel="Record something for today"
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedView type="backgroundElement" style={styles.door}>
          <MaterialCommunityIcons name="star-four-points-outline" size={20} color={theme.accentDeep} />
          <ThemedText type="smallBold" style={styles.doorText}>
            Anything to note today?
          </ThemedText>
          <MaterialCommunityIcons name="chevron-right" size={22} color={theme.accent} />
        </ThemedView>
      </Pressable>

      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        Or just tell Selodía in chat.
      </ThemedText>
    </BodyScreen>
  );
}

const styles = StyleSheet.create({
  pattern: { gap: 4, padding: Spacing.four, borderRadius: CardRadius, marginBottom: Spacing.four },
  spaced: { marginTop: Spacing.two, lineHeight: 18 },
  action: { gap: Spacing.two, alignItems: 'flex-start', marginBottom: Spacing.five },
  button: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.four, borderRadius: Spacing.four },
  year: { gap: Spacing.one, marginBottom: Spacing.four },
  door: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginTop: Spacing.two,
  },
  doorText: { flex: 1 },
  empty: { lineHeight: 20, marginBottom: Spacing.four },
  hint: { lineHeight: 18, marginTop: Spacing.three },
  pressed: { opacity: 0.6 },
});
