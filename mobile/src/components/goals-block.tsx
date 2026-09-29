import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayGoal } from '@/lib/goal-display';
import { supabase } from '@/lib/supabase';

// WHAT YOU'RE WORKING TOWARDS. The top of Plans, above the segmented control.
//
// ONE SOURCE NOW, AND IT IS user_goals. This block used to read user_goals AND
// user_context and concatenate them, which produced exactly what Ruth found:
// the same goal twice, and a superseded one that never went away. The fix is a
// database trigger that mirrors any goal written to user_context into
// user_goals, so there is one place to read and the guard sits at the write
// where a future writer cannot miss it.
//
// CURRENT ONLY. History lives on the Goal screen and nowhere else, which is her
// instruction and is also the right shape: a list that shows everything you
// have ever wanted is a list you stop reading.
//
// CAPITALISED AT RENDER, NEVER IN THE DATABASE. See lib/goal-display.ts.
//
// NO COUNTERS, NO PERCENTAGES, NO BARS, and no sense of a deadline.

export type Goal = {
  id: string;
  label: string;
  detail: string | null;
  set_on: string | null;
};

export const GOALS_EMPTY = 'Nothing set yet';
export const GOALS_EMPTY_BODY =
  'Say what you would like to work towards in chat, and it will show here.';

export function GoalsBlock() {
  const theme = useTheme();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const { data, error } = await supabase
          .from('user_goals')
          .select('id, label, detail, set_on')
          .is('archived_at', null)
          .order('set_on', { ascending: false })
          .order('created_at', { ascending: false });
        if (cancelled) return;
        setGoals(error ? [] : ((data ?? []) as Goal[]));
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
          <Pressable
            key={goal.id}
            onPress={() => router.push({ pathname: '/goal', params: { id: goal.id } })}
            accessibilityRole="link"
            accessibilityLabel={`${displayGoal(goal.label)}. Open the goal`}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={[styles.card, styles.cardRow]}>
              <View style={styles.cardText}>
                <ThemedText type="small">{displayGoal(goal.label)}</ThemedText>
                {goal.detail ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {goal.detail}
                  </ThemedText>
                ) : null}
              </View>
              {/* accentDeep rather than accent: full-strength terracotta on sand
                  is 2.43:1, under even the 3:1 a non-text control needs. */}
              <Ionicons name="chevron-forward" size={16} color={theme.accentDeep} />
            </ThemedView>
          </Pressable>
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
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  // Takes the slack so the chevron keeps the right edge, and wraps rather than
  // clipping when a goal runs to two lines - which most of them do.
  cardText: { flex: 1, gap: Spacing.one },
  pressed: { opacity: 0.7 },
});
