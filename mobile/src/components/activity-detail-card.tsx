import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Tag } from '@/components/tag';
import { DeleteEntry } from '@/components/delete-entry';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { formatLogDate } from '@/lib/week';

// The detail card for one logged session (2026-09-16).
//
// WHY IT EXISTS. Ruth: "The eye card once open should always have a way to take
// it to 'Ask about this', same as throughout the rest of the app." Activity had
// no eye card at all, so there was nothing to open and nothing to ask from -
// the food log had both and activity had neither, which is exactly the
// inconsistency she was pointing at.
//
// IT TAKES THE ROW IT WAS GIVEN, and reads back one thing: the movements
// (2026-09-18). Ruth recorded a session with an adapted movement, an added one
// and a note, opened it in the log, and the card said "When: Today" and nothing
// else - "workout details not saved into log". Everything WAS saved; this card
// simply drew none of it. A session's movements live in their own table, linked
// by activity_log_id, which is exactly the case the paragraph that used to sit
// here said did not exist.
//
// The note is shown too. It is the part somebody wrote in their own words, and
// it was the only thing on the review sheet that asked for effort.
//
// NO INTERPRETATION NOTE. Item 29 writes notes against body measurements only,
// so there is nothing stored to show for a session, and computing one live is
// what that item exists to prevent.

export type ActivityDetail = {
  id: string;
  activity_type: string | null;
  duration_min: number | null;
  kcal_burned: number | null;
  distance_km?: number | null;
  intensity: string | null;
  happened_at: string;
  /** What they said about the session, when they said anything. */
  notes?: string | null;
};

export function ActivityDetailCard({
  activity,
  onClose,
  onDeleted,
}: {
  activity: ActivityDetail | null;
  onClose: () => void;
  // Called instead of onClose when the session was removed, so the list behind
  // this card can re-read rather than keep drawing a row that no longer exists.
  onDeleted?: () => void;
}) {
  const theme = useTheme();
  const [movements, setMovements] = useState<string[]>([]);
  const activityId = activity?.id ?? null;

  // The movements recorded against this session. Ordinary activity rows have
  // none and simply show nothing, which is correct rather than empty.
  useEffect(() => {
    if (!activityId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('workout_completion_log')
        .select('exercise_name, created_at')
        .eq('activity_log_id', activityId)
        .order('created_at', { ascending: true });
      if (!cancelled) {
        setMovements(
          ((data ?? []) as { exercise_name: string }[]).map((r) => r.exercise_name).filter(Boolean)
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  if (!activity) return null;

  const title = activity.activity_type ?? 'Movement';
  const rows: [string, string][] = [
    ['When', formatLogDate(new Date(activity.happened_at))],
    ...(activity.duration_min != null
      ? ([['Duration', `${Math.round(activity.duration_min)} min`]] as [string, string][])
      : []),
    ...(activity.kcal_burned != null
      ? ([['Burned', `${Math.round(activity.kcal_burned)} kcal`]] as [string, string][])
      : []),
    ...(activity.distance_km != null
      ? ([['Distance', `${Math.round(activity.distance_km * 10) / 10} km`]] as [string, string][])
      : []),
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} accessibilityViewIsModal>
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.scrim }]}
        onPress={onClose}
        accessibilityLabel="Close"
      />
      <View style={styles.centre} pointerEvents="box-none">
        <ThemedView style={styles.card}>
          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.headerRow}>
              <ThemedText type="smallBold" style={styles.title}>
                {title}
              </ThemedText>
              {/* Classified at log time (item 33): an older row with no
                  intensity renders no tag rather than a guess. */}
              <Tag context="intensity" value={activity.intensity} />
            </View>

            {rows.map(([label, value]) => (
              <ThemedView key={label} type="backgroundElement" style={styles.metric}>
                <ThemedText type="small" themeColor="textSecondary">
                  {label}
                </ThemedText>
                <ThemedText type="small">{value}</ThemedText>
              </ThemedView>
            ))}

            {/* WHAT WAS ACTUALLY MOVED THROUGH. Listed, not counted: "6
                movements" is a number, and the names are the record. */}
            {movements.length > 0 && (
              <View style={styles.block}>
                <ThemedText type="small" themeColor="textSecondary">
                  Movements recorded
                </ThemedText>
                {movements.map((m, i) => (
                  <ThemedText key={`${m}-${i}`} type="small">
                    {m}
                  </ThemedText>
                ))}
              </View>
            )}

            {activity.notes?.trim() ? (
              <View style={styles.block}>
                <ThemedText type="small" themeColor="textSecondary">
                  What you said
                </ThemedText>
                <ThemedText type="small">{activity.notes.trim()}</ThemedText>
              </View>
            ) : null}

            {/* The same words and the same behaviour as the food card, because
                it is the same action: the session's id and type ride to Chat,
                and ask-selodia tags that turn with them. */}
            <Pressable
              onPress={() => {
                onClose();
                router.push({
                  pathname: '/',
                  params: {
                    prefill: `About my "${title}" session: `,
                    discussId: activity.id,
                    discussType: 'activity',
                    // Sends, rather than filling the box - see food-breakdown-card.
                    askNow: '1',
                    // WHAT IS ALREADY ON SCREEN, handed across so the card in
                    // chat draws in the same frame as her message rather than
                    // after its own read comes back. This card reads nothing
                    // itself, so every one of these is a value the caller was
                    // already holding. See food-breakdown-table.tsx for why.
                    seedTitle: title,
                    seedWhen: activity.happened_at,
                    seedDetail: [
                      activity.duration_min != null
                        ? `${Math.round(activity.duration_min)} min`
                        : null,
                      activity.kcal_burned != null
                        ? `${Math.round(activity.kcal_burned)} kcal`
                        : null,
                    ]
                      .filter((p): p is string => p !== null)
                      .join(' · '),
                  },
                });
              }}
              accessibilityRole="button"
              accessibilityLabel="Ask about this"
              hitSlop={Spacing.two}
              style={({ pressed }) => [styles.ask, pressed && styles.pressed]}
            >
              <ThemedText type="smallBold" themeColor="accentDeep">
                Ask about this
              </ThemedText>
            </Pressable>

            {/* The entry's own delete: quiet, last, and the one thing here that
                cannot be undone (2026-09-18). */}
            <DeleteEntry
              table="activity_logs"
              id={activity.id}
              what="this session"
              onDeleted={onDeleted ?? onClose}
            />
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.close}>
                Close
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  card: { width: '100%', maxWidth: MaxContentWidth, borderRadius: Spacing.two, overflow: 'hidden' },
  body: { padding: Spacing.three, gap: Spacing.two },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: { flex: 1 },
  metric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.one,
  },
  block: { gap: Spacing.half, paddingTop: Spacing.two },
  ask: { alignSelf: 'flex-start', paddingVertical: Spacing.one },
  actions: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, alignItems: 'flex-end' },
  close: { paddingVertical: Spacing.one },
  pressed: { opacity: 0.6 },
});
