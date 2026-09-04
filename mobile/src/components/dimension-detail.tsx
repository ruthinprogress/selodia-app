import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFont, MaxContentWidth, Spacing } from '@/constants/theme';
import type { DimensionActivity } from '@/hooks/use-dimension-activities';
import {
  DIMENSION_COLOUR,
  DIMENSION_DEEP,
  DIMENSION_LABEL,
  emptyDimensionLine,
  type Dimension,
} from '@/lib/health-flower';
import { formatLogDate } from '@/lib/week';

// One dimension's week, as a presentational component.
//
// SEPARATE FROM THE ROUTE so it can be rendered with fixed data - which is how
// the four states below were actually looked at before shipping, rather than
// reasoned about. The route owns the query; this owns the picture.
//
// FULL BLEED IN THE PETAL'S OWN COLOUR, with CHARCOAL type on it. Cream was
// specified first and measured worse than anything else in the app: the six
// petals run 1.79:1 to 2.59:1 against cream, missing even the 3.0 allowed for
// large text, with cardio the worst at 1.79. Charcoal on those same unmodified
// colours runs 4.91:1 to 7.12:1. So the colour stayed exactly the petal's and
// the text changed, which also keeps the screen unmistakably about THIS one.
//
// The only cream on the page is the button label, on a deep shade of the same
// petal at 5.5:1 or better.
//
// THIS SCREEN DOES NOT SCORE. No percentage, no total, no "nearly there". It
// lists what happened, and when nothing did it says so and stops.
export function DimensionDetail({
  dimension,
  activities,
  loading,
}: {
  dimension: Dimension;
  activities: DimensionActivity[];
  loading: boolean;
}) {
  const background = DIMENSION_COLOUR[dimension];
  const deep = DIMENSION_DEEP[dimension];
  const rows = activities ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: background }]}>
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>{DIMENSION_LABEL[dimension]}</Text>
          <Text style={styles.sub}>this week</Text>

          <View style={styles.list}>
            {loading ? null : rows.length === 0 ? (
              <Text style={styles.empty}>{emptyDimensionLine(dimension)}</Text>
            ) : (
              rows.map((a) => (
                <View key={a.id} style={styles.row}>
                  <Text style={styles.activity}>{a.activity_type ?? 'Activity'}</Text>
                  <Text style={styles.meta}>
                    {formatLogDate(new Date(a.happened_at))}
                    {/* Duration only where it is known. A row without one says
                        nothing rather than guessing, the same rule the log
                        itself now holds to. */}
                    {a.duration_min != null ? `  ·  ${Math.round(a.duration_min)} min` : ''}
                  </Text>
                </View>
              ))
            )}
          </View>

          <Pressable
            onPress={() => router.push('/')}
            accessibilityRole="button"
            accessibilityLabel={`Explore your ${DIMENSION_LABEL[dimension].toLowerCase()} in Chat`}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: deep },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.buttonText}>Explore this  →</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const CHARCOAL = '#2D2B28';
const CREAM = '#F7F3EA';

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: {
    padding: Spacing.four,
    paddingTop: Spacing.five,
    gap: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  title: {
    fontFamily: BrandFont.regular,
    fontSize: 40,
    lineHeight: 48,
    color: CHARCOAL,
  },
  sub: {
    fontFamily: BrandFont.regular,
    fontSize: 15,
    color: CHARCOAL,
    // The one place opacity is used on this screen. At 0.65 on these grounds it
    // still clears AA comfortably, which 0.5 would not on the lighter petals.
    opacity: 0.65,
    marginBottom: Spacing.four,
  },
  list: { gap: Spacing.three },
  row: { gap: 2 },
  activity: { fontFamily: BrandFont.medium, fontSize: 17, color: CHARCOAL },
  meta: { fontFamily: BrandFont.regular, fontSize: 13, color: CHARCOAL, opacity: 0.7 },
  empty: {
    fontFamily: BrandFont.regular,
    fontSize: 16,
    lineHeight: 26,
    color: CHARCOAL,
    opacity: 0.8,
    maxWidth: 300,
  },
  button: {
    marginTop: Spacing.five,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    alignSelf: 'flex-start',
  },
  buttonText: { fontFamily: BrandFont.medium, fontSize: 16, color: CREAM },
  pressed: { opacity: 0.75 },
});
