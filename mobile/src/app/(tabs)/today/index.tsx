import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HydrationToast, type WaterAction } from '@/components/hydration-card';
import { OverviewPanel } from '@/components/overview-panel';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, PageInset, Spacing } from '@/constants/theme';

// THE NO-SCROLL RULE IS RETIRED, 2026-09-16, and it is worth saying why rather
// than quietly deleting it.
//
// It read: "this screen is specified not to scroll... anything that will not fit
// here belongs in a detail screen", and it was a good rule that held for six
// weeks. What retired it was Ruth asking for "What you burn" to sit on this
// screen because it was too hidden on Activity - a seventh child on a fixed
// flex view, which does not overflow gracefully: it simply sits below the fold
// with no way to reach it, which is precisely what she reported ("Overview there
// but no burn at the bottom").
//
// The choice was between refusing her the panel, shrinking something else on a
// screen already cut twice to fit, or letting the screen scroll. The rule
// existed to keep this a glance rather than a page; a glance that CAN scroll is
// still a glance, and everything that was above the fold is still above it.
export default function BodyOverviewScreen() {
  // The water card's Undo note, drawn here - outside the scroll view - so it
  // floats above the bottom navigation wherever the page is scrolled to.
  const [water, setWater] = useState<WaterAction | null>(null);
  const [undone, setUndone] = useState<{ ml: number; id: string } | null>(null);
  const clearWater = useCallback(() => setWater(null), []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* flexGrow, not flex, on the content container: it lets the screen fill
            the viewport when there is room and grow past it when there is not,
            which is what keeps the layout identical to the old fixed one until
            the content genuinely outgrows the screen. */}
        <ScrollView contentContainerStyle={styles.content}>
          <OverviewPanel onWaterAdded={setWater} waterUndone={undone} />
        </ScrollView>
        <HydrationToast
          action={water}
          onUndone={(ml, id) => setUndone({ ml, id })}
          onDone={clearWater}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    // flexGrow rather than flex: fills the viewport when the content is short,
    // and grows past it when it is not. flex:1 on a scroll content container
    // pins the height to the viewport, which is what made the new panel
    // unreachable rather than simply below the fold.
    flexGrow: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: PageInset.horizontal,
    paddingTop: PageInset.top,
    paddingBottom: PageInset.bottom,
  },
});
