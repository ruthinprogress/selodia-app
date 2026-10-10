import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BodyScreen } from '@/components/body-screen';
import { Card, Chips } from '@/components/cycle-cards';
import { CycleHistoryBars } from '@/components/cycle-history-bars';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { bleedState, CHOOSABLE_DAYS, lastBleedLength, recentDays } from '@/lib/period-row';
import { expectedNextPeriod, knowledgeFrom } from '@/lib/cycle-history';
import { currentUserId } from '@/lib/current-user';
import { human, midSentence, today } from '@/lib/day-names';
import { supabase } from '@/lib/supabase';

// THE CYCLE SCREEN IS THE HISTORY SCREEN.
//
// Build spec, 9 October 2026, confirmed by Ruth the same day: "Six of the eight
// sections - flow, symptoms, feeling, ovulation, mucus, notes - move inside a
// day. What remains is the period action and the history... That is the whole
// screen, and it is a short one: the state-aware period row, the 'anything
// today?' row, the summary card, and the bars."
//
// It was eight reorderable cards until 10 October, and the night of the 9th left
// it that way while adding the new bars and the new symptom list INTO it, which
// is how she ended up with a screen she had already asked to be changed. Her
// words: "Not what we designed."
//
// THE ARRANGING MACHINERY WENT WITH THE CARDS, as the spec says: "A screen with
// three things on it does not need a drag handle." The stored cycle_layout rows
// are deliberately left alone rather than deleted - they cost nothing, and a
// future screen may want the same mechanism.
//
// WHAT IT WILL NOT DO is tell her what her cycle means. It records, it counts,
// and where it estimates it says so and says on what - see cycle-history.ts,
// where one logged period earns a position and no prediction at all.

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
      // so asking it for a day number returns nothing. The first version of
      // this did exactly that and would have shown "That cycle is closed."
      // with no number after it, every time.
      setClosed(lastBleedLength(next));
    } else {
      setClosed(null);
      setNote(`Period start recorded for ${midSentence(on)}.`);
    }
  }

  const knowledge = knowledgeFrom(events);
  const next = expectedNextPeriod(knowledge);
  const bleed = bleedState(events, today());

  return (
    <BodyScreen title="Cycle">
      {/* THE PERIOD ROW READS AS A SENTENCE ABOUT WHERE SHE IS NOW.
          Ruth, 9 October 2026: "There is something missing, and that's how to
          say when the period ended." A row that only ever offered to START one
          is why there was no way to end one. */}
      <Card icon="water" title="Period">
        {closed !== null ? (
          <>
            <ThemedText type="small">That cycle is closed. {closed} days.</ThemedText>
            <Pressable
              onPress={() => setClosed(null)}
              accessibilityRole="button"
              accessibilityLabel="Done"
              hitSlop={Spacing.two}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedText type="small" themeColor="link">
                Done
              </ThemedText>
            </Pressable>
          </>
        ) : bleed.state === 'bleeding' ? (
          <>
            <ThemedText type="smallBold">Day {bleed.dayOfPeriod} of your period</ThemedText>
            <View style={styles.row}>
              <Pressable
                onPress={() => void mark('period_end', today())}
                accessibilityRole="button"
                accessibilityLabel="Record that your period has stopped"
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedView style={[styles.action, { backgroundColor: theme.accentDeep }]}>
                  <ThemedText type="smallBold" themeColor="background">
                    It&apos;s stopped
                  </ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => setChoosing((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel="Choose the day it stopped"
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedView type="background" style={styles.action}>
                  <ThemedText type="small">Choose the day</ThemedText>
                </ThemedView>
              </Pressable>
            </View>
            {/* REMEMBERING TWO DAYS LATE IS THE ORDINARY WAY THIS GETS LOGGED
                (build spec, 9 October), so this is not an edge case behind a
                menu. */}
            {choosing && (
              <Chips
                options={recentDays(today(), CHOOSABLE_DAYS).map(human)}
                selected={[]}
                single
                onToggle={(label) => {
                  const d = recentDays(today(), CHOOSABLE_DAYS).find((x) => human(x) === label);
                  if (d) void mark('period_end', d);
                }}
              />
            )}
          </>
        ) : (
          <>
            <Pressable
              onPress={() => void mark('period_start', today())}
              accessibilityRole="button"
              accessibilityLabel="Record a period starting today"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedView style={[styles.action, { backgroundColor: theme.accentDeep }]}>
                <ThemedText type="smallBold" themeColor="background">
                  Period started today
                </ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable
              onPress={() => setChoosing((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Choose the day it started"
              hitSlop={Spacing.two}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedText type="small" themeColor="link">
                Choose the day
              </ThemedText>
            </Pressable>
            {choosing && (
              <Chips
                options={recentDays(today(), CHOOSABLE_DAYS).map(human)}
                selected={[]}
                single
                onToggle={(label) => {
                  const d = recentDays(today(), CHOOSABLE_DAYS).find((x) => human(x) === label);
                  if (d) void mark('period_start', d);
                }}
              />
            )}
          </>
        )}

        {note && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {note}
          </ThemedText>
        )}
        {next && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            Next one expected around {human(next.on)}
            {next.give > 0 ? `, give or take ${next.give} ${next.give === 1 ? 'day' : 'days'}` : ''}.
          </ThemedText>
        )}
        {!next && knowledge.basis === 'nominal' && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            Once a few periods are recorded, Selodía can say when the next one is likely. One is not enough to say
            anything useful about it.
          </ThemedText>
        )}
      </Card>

      {/* THE WAY INTO A DAY. Six cards moved in here, so there has to be a door
          and it has to be on the first screen. */}
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

      <Card icon="history" title="Recorded so far">
        {/* BARS, NOT A LIST (9 October 2026). Ruth: "it's just a long list atm."
            One bar per cycle, length proportional, which is what she opens this
            screen to find out. Tapping one opens that day. */}
        <CycleHistoryBars
          events={events}
          today={today()}
          onOpenDay={(d) => router.push({ pathname: '/log/cycle-day', params: { day: d } })}
        />
      </Card>

      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        Or just tell Selodía in chat.
      </ThemedText>
    </BodyScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  action: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.four, borderRadius: Spacing.four },
  door: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.four,
  },
  doorText: { flex: 1 },
  hint: { lineHeight: 18 },
  pressed: { opacity: 0.6 },
});
