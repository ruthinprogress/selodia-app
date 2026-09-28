import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

// WHAT YOU'RE WORKING TOWARDS. The top of Plans, above the segmented control.
//
// MOVED FROM SETTINGS > PROFILE, where it was a read-only group at the bottom
// of a page about height and date of birth. Settings is plumbing: account,
// notifications, what happens to your data. A goal is not plumbing, it is the
// reason the rest of Plans exists, and it belongs above the things that serve
// it.
//
// TWO SOURCES, ON PURPOSE, AND BOTH ARE REAL.
//
//   user_context (category = 'goal') is what CHAT writes, in her own words.
//   Ruth's account carries two of them, including "reduce body fat and get back
//   into old jeans", which is a better sentence than anything a dropdown will
//   ever produce and is exactly why the chat path is not being replaced.
//
//   user_goals is what the TAPS write, from the seven options in lib/goals.ts,
//   and those rows are the ones that set a focus state.
//
// Reading both is the honest arrangement while chat still writes to
// user_context. Merging them into one table would mean changing the chat
// pipeline, which is not this slice's job, and doing it halfway would mean a
// goal that shows in one place and not the other. Worth consolidating later;
// noted rather than quietly deferred.
//
// NO COUNTERS, NO PERCENTAGES, NO BARS, and no sense of a deadline. Each goal
// is one line. The optional measure underneath is what she said, quoted back,
// and nothing counts down from it.

export type Goal = {
  id: string;
  label: string;
  detail: string | null;
};

export const GOALS_EMPTY = 'Nothing set yet';
export const GOALS_EMPTY_BODY =
  'Say what you would like to work towards in chat, and it will show here.';

export function GoalsBlock() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [tapped, written] = await Promise.all([
          supabase
            .from('user_goals')
            .select('id, label, detail')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true }),
          supabase.from('user_context').select('id, category, content'),
        ]);
        if (cancelled) return;

        const fromTaps = (tapped.error ? [] : ((tapped.data ?? []) as Goal[]));
        const fromChat = (written.error ? [] : (written.data ?? []))
          .filter((row) => {
            const r = row as { category: string | null };
            return (r.category ?? '').toLowerCase().includes('goal');
          })
          .map((row) => {
            const r = row as { id: string; content: string };
            // Her own sentence is the label. There is no detail line, because
            // there is nothing to separate out: she said one thing.
            return { id: `context:${r.id}`, label: r.content, detail: null };
          });

        // Taps first, then her own words. The tapped ones set the targets, so
        // they are the ones an answer on this screen explains.
        setGoals([...fromTaps, ...fromChat]);
        setLoaded(true);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  // NOTHING IS DRAWN BEFORE THE ANSWER ARRIVES. An empty state that appears for
  // a moment and is then replaced reads as "you have nothing", which is the one
  // thing this block must never say by accident.
  if (!loaded) return null;

  return (
    <ThemedView style={styles.block}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.heading}>
        What you&apos;re working towards
      </ThemedText>

      {goals.length === 0 ? (
        <Pressable
          onPress={() => router.push('/')}
          accessibilityRole="link"
          accessibilityLabel={`${GOALS_EMPTY}. ${GOALS_EMPTY_BODY}`}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="small">{GOALS_EMPTY}</ThemedText>
            <ThemedText type="small" themeColor="accentDeep">
              {GOALS_EMPTY_BODY}
            </ThemedText>
          </ThemedView>
        </Pressable>
      ) : (
        goals.map((goal) => (
          <ThemedView key={goal.id} type="backgroundElement" style={styles.card}>
            <ThemedText type="small">{goal.label}</ThemedText>
            {goal.detail ? (
              <ThemedText type="small" themeColor="textSecondary">
                {goal.detail}
              </ThemedText>
            ) : null}
          </ThemedView>
        ))
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.two,
  },
  heading: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  card: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: CardRadius,
    gap: Spacing.one,
  },
  pressed: { opacity: 0.7 },
});
