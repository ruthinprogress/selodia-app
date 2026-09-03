import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OverviewPanel } from '@/components/overview-panel';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

// Overview does NOT use BodyScreen, and that is the point: BodyScreen supplies a
// ScrollView, and this screen is specified not to scroll. It renders in a plain
// flex view so the constraint is structural rather than a promise about content
// length - anything that will not fit here belongs in a detail screen.
//
// No SpotlightScroll either, and nothing needs it. useSpotlightScroll() returns
// null outside a provider rather than throwing, so targets on this screen still
// register and measure; they simply have nothing to scroll themselves into,
// which is correct when everything is already on screen.
export default function BodyOverviewScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedView style={styles.content}>
          <OverviewPanel />
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
});
