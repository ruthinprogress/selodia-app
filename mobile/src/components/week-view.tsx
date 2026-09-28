import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

// MY WEEK: the rhythm, not a calendar.
//
// A LIST, AS THE SPEC ASKS AND AS HER PROTOTYPE DRAWS IT. Each row is an
// activity, a one-line purpose, and a cadence on the right: "Ballet / turnout,
// balance, calf pump / 1x/week, 1.5 hrs". The purpose line is the whole reason
// this is not a chore list - it says why the thing is in her week at all.
//
// NOTHING IS MARKED DONE, MISSED, OR BEHIND. The spec's hard rule for this
// screen, and the Witness Principle applied to the one place a baseline invites
// a score. The table has no completion column at all, so it cannot creep back in
// later without somebody deciding to add one.
//
// A ROW OPENS ITS SESSION when there is one. Week and Sessions are two objects,
// not two views of one: a cadence, and a thing to do. That is why editing a
// session in Sessions changes what this row points at and never leaves two
// versions of Tuesday lying about.

type WeekRow = {
  id: string;
  activity: string;
  purpose: string | null;
  cadence: string | null;
  duration: string | null;
  session_entry_id: string | null;
  days: string[];
};

export const WEEK_EMPTY = 'No week yet';
export const WEEK_EMPTY_BODY =
  'Tell Selodía what a normal week looks like for you, and it will keep the shape of it here.';

export function WeekView({ onOpenSession }: { onOpenSession?: (entryId: string) => void }) {
  const [rows, setRows] = useState<WeekRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const { data, error } = await supabase
          .from('user_week')
          .select('id, activity, purpose, cadence, duration, session_entry_id, days')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });
        if (!cancelled) {
          setRows(error ? [] : ((data ?? []) as WeekRow[]));
          setLoaded(true);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (!loaded) return null;

  if (rows.length === 0) {
    return (
      <Pressable
        onPress={() => router.push('/')}
        accessibilityRole="link"
        accessibilityLabel={`${WEEK_EMPTY}. ${WEEK_EMPTY_BODY}`}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">{WEEK_EMPTY}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {WEEK_EMPTY_BODY}
          </ThemedText>
        </ThemedView>
      </Pressable>
    );
  }

  return (
    <ThemedView style={styles.block}>
      {rows.map((row) => {
        const right = [row.cadence, row.duration].filter(Boolean).join(' · ');
        const openable = Boolean(row.session_entry_id && onOpenSession);
        const body = (
          <ThemedView type="backgroundElement" style={styles.row}>
            <View style={styles.rowTop}>
              <ThemedText type="small" style={styles.activity}>
                {row.activity}
              </ThemedText>
              {right ? (
                <ThemedText type="small" themeColor="accentDeep">
                  {right}
                </ThemedText>
              ) : null}
            </View>
            {row.purpose ? (
              <ThemedText type="small" themeColor="textSecondary">
                {row.purpose}
              </ThemedText>
            ) : null}
            {/* DAYS ONLY EXIST IN GUIDE ME (Slice 6), and an empty array is the
                normal state rather than a gap. Somebody who chose "let me lead"
                has a rhythm and no days, which is the whole difference between
                the two settings. */}
            {row.days.length > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {row.days.map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(' · ')}
              </ThemedText>
            ) : null}
          </ThemedView>
        );

        return openable ? (
          <Pressable
            key={row.id}
            onPress={() => onOpenSession?.(row.session_entry_id as string)}
            accessibilityRole="link"
            accessibilityLabel={`${row.activity}${right ? `, ${right}` : ''}, open the session`}
            style={({ pressed }) => pressed && styles.pressed}>
            {body}
          </Pressable>
        ) : (
          <View key={row.id}>{body}</View>
        );
      })}

      <ThemedText type="small" themeColor="textSecondary">
        This is the shape of your week, not a score. Nothing here is ever marked done or missed.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.two },
  row: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: CardRadius,
    gap: Spacing.one,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  // Takes the slack so the cadence keeps the right edge, and wraps rather than
  // clipping when an activity name runs long.
  activity: { flexShrink: 1 },
  card: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: CardRadius,
    gap: Spacing.one,
  },
  pressed: { opacity: 0.7 },
});
