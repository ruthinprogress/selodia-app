import { router } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Tag } from '@/components/tag';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatLogDate } from '@/lib/week';

// The detail card for one logged session (2026-09-16).
//
// WHY IT EXISTS. Ruth: "The eye card once open should always have a way to take
// it to 'Ask about this', same as throughout the rest of the app." Activity had
// no eye card at all, so there was nothing to open and nothing to ask from -
// the food log had both and activity had neither, which is exactly the
// inconsistency she was pointing at.
//
// IT TAKES THE ROW IT WAS GIVEN and reads nothing back. A session is small
// enough to be entirely on screen already, unlike a food log whose items live in
// their own table; a second read here would be a query for data the caller is
// holding.
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
};

export function ActivityDetailCard({
  activity,
  onClose,
}: {
  activity: ActivityDetail | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  if (!activity) return null;

  const title = activity.activity_type ?? 'Activity';
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
  ask: { alignSelf: 'flex-start', paddingVertical: Spacing.one },
  actions: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, alignItems: 'flex-end' },
  close: { paddingVertical: Spacing.one },
  pressed: { opacity: 0.6 },
});
