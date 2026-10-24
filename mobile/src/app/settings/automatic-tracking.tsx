import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { SettingsGroup, SettingsPage, SettingsRow } from '@/components/settings-page';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  statusLabel,
  TRACKING_GROUPS,
  TRACKING_LABEL,
  type TrackingKind,
  type TrackingState,
} from '@/lib/automatic-tracking';
import { hasSleepPermission, readNightsFromPhone } from '@/lib/sleep-sync';

// EVERYTHING THE PHONE CAN SEND, IN ONE LIST (Ruth's artwork, screen 2).
//
// Her instruction, 24 October: "everything needs to be within the app, clean
// and easy to understand."
//
// WHAT THIS REPLACES. Automatic tracking used to be discoverable only by
// finding a card buried inside the Sleep log, which meant steps were set up in
// one place, sleep in another, and nothing told you what else your phone could
// send. One list answers "what can this app read, and what is it reading now"
// in a glance, which is the question somebody actually has.
//
// THE FIVE THAT ARE NOT BUILT ARE SHOWN ANYWAY, as her artwork draws them, and
// marked Not enabled. That is the honest state of a thing that is coming, and
// the alternative - a shorter list - hides the roadmap from the one person
// entitled to see it. What would be dishonest is a row that offers to turn
// something on and then does nothing, which is why those rows say so on their
// own screen rather than lying in a toggle.

/**
 * ONE MARK PER GROUP, NOT PER TYPE.
 *
 * Twenty-four borrowed glyphs is the inconsistency the nutrient icons were
 * drawn to fix - a sun, a molecule and a salt cellar are three drawing
 * languages. The group carries the mark; the rows under it carry the words.
 */
const GROUP_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Sleep: 'moon-outline',
  Movement: 'walk-outline',
  Body: 'body-outline',
  'Heart and vitals': 'heart-outline',
  Cycle: 'ellipse-outline',
  'Food and drink': 'water-outline',
};

export default function AutomaticTrackingScreen() {
  const theme = useTheme();
  const [sleep, setSleep] = useState<{ state: TrackingState; detail: string | null }>({
    state: 'not-enabled',
    detail: null,
  });

  // RE-READ ON ARRIVAL, because the thing that changes this is a trip out to
  // the system permission sheet and back. A status read once on mount would be
  // stale at exactly the moment somebody returns to check it.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const allowed = await hasSleepPermission();
        if (cancelled) return;
        if (!allowed) {
          setSleep({ state: 'not-enabled', detail: null });
          return;
        }
        const nights = await readNightsFromPhone(30);
        if (cancelled) return;
        const latest = nights[nights.length - 1];
        setSleep(
          latest
            ? {
                state: 'receiving',
                detail: `Last night: ${Math.floor(latest.minutes / 60)}h ${String(
                  latest.minutes % 60
                ).padStart(2, '0')}m`,
              }
            : { state: 'waiting', detail: null }
        );
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const stateOf = (kind: TrackingKind): { state: TrackingState; detail: string | null } =>
    kind === 'sleep' ? sleep : { state: 'not-enabled', detail: null };

  return (
    <SettingsPage
      title="Automatic tracking"
      subtitle="Sleep, steps and other information Selodía can import automatically from your phone or wearable."
    >
      {TRACKING_GROUPS.map((group) => (
        <SettingsGroup key={group.title} title={group.title}>
          {group.kinds.map((kind, i) => {
            const { state, detail } = stateOf(kind);
            return (
              <SettingsRow
                key={kind}
                first={i === 0}
                icon={i === 0 ? GROUP_ICON[group.title] : undefined}
                label={TRACKING_LABEL[kind]}
                detail={statusLabel(state, detail)}
                onPress={() => router.push(`/settings/automatic-tracking/${kind}` as never)}
              />
            );
          })}
        </SettingsGroup>
      ))}

      {/* WHERE THE DATA COMES FROM, which is hers and is the one piece of
          explanation that belongs on this screen. It answers the question
          somebody has BEFORE they tap anything: what is this reading, and can I
          change my mind. Everything else is on the type's own page. */}
      <ThemedView type="backgroundElement" style={styles.note}>
        <ThemedText type="smallBold">Where the data comes from</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.noteBody}>
          Selodía reads data from your phone&apos;s health system, which includes apps and
          wearables. You choose exactly what to share, and you can change it at any time.
        </ThemedText>
      </ThemedView>

      {/* THE GREEN DOT IN HER DRAWING, said in words as well. A colour alone
          cannot carry a status - see the nutrient grid for the same rule. */}
      <View style={styles.legend}>
        <View style={[styles.dot, { backgroundColor: theme.sage }]} />
        <ThemedText type="detail" themeColor="textSecondary">
          Arriving on its own
        </ThemedText>
      </View>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  note: { borderRadius: CardRadius, padding: Spacing.three, gap: Spacing.two, marginTop: Spacing.three },
  noteBody: { lineHeight: 20 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.three },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
