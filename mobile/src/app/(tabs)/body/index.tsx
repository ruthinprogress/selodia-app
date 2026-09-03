import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BodyScreen } from '@/components/body-screen';
import { OverviewPanel } from '@/components/overview-panel';
import { SpotlightTarget } from '@/components/spotlight-target';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { SpotlightId } from '@/lib/spotlight';

// The Body tab's landing screen.
//
// The row of links below is TEMPORARY. The design replaces it with three
// tappable section headers inside the Overview itself, each one both a heading
// and the way into that section's detail. That is the next piece of work; this
// row exists so that no commit in between leaves Food, Measurements or Activity
// unreachable. It also keeps the three existing spotlight targets pointing at
// something real until the spotlight pass reworks them.
//
// `body.overview` is deliberately not registered here any more: it pointed at
// the Overview segment button, and Overview is the screen now rather than a
// button on it. The id still exists in the registry, and an unregistered id
// renders nothing rather than a ring at the origin, so nothing breaks while the
// two packages are brought back into step.
const LINKS: { key: string; label: string; href: Href; target: SpotlightId }[] = [
  { key: 'food', label: 'Food', href: '/body/food', target: 'body.food' },
  { key: 'measurements', label: 'Measurements', href: '/body/measurements', target: 'body.measurements' },
  { key: 'activity', label: 'Activity', href: '/body/activity', target: 'body.activity' },
];

export default function BodyOverviewScreen() {
  return (
    <BodyScreen>
      <OverviewPanel />

      <View style={styles.links}>
        {LINKS.map((l) => (
          <SpotlightTarget
            key={l.key}
            id={l.target}
            onActivate={() => router.push(l.href)}
          >
            <Pressable
              onPress={() => router.push(l.href)}
              accessibilityRole="button"
              accessibilityLabel={l.label}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedView type="backgroundElement" style={styles.link}>
                <ThemedText type="smallBold">{l.label}</ThemedText>
              </ThemedView>
            </Pressable>
          </SpotlightTarget>
        ))}
      </View>
    </BodyScreen>
  );
}

const styles = StyleSheet.create({
  links: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  link: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
