import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

// Ephemeral save confirmation, deliberately unlike a chat bubble: a muted grey
// pill (textSecondary background, contrasting text) that fades in, holds, and
// fades out - a system confirmation the app shows, not something Unflump "said",
// so it never competes with the emotional content of a reply. Trigger by
// passing a new `nonce` (with the summary) on each save; it re-animates each time.
export function SaveConfirmation({ summary, nonce }: { summary: string | null; nonce: number }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!summary || nonce <= 0) return;
    opacity.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [nonce, summary, opacity]);

  if (!summary) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { opacity }]}>
      <ThemedView type="textSecondary" style={styles.pill}>
        <ThemedText type="small" themeColor="background">
          ✓ Saved · {summary}
        </ThemedText>
      </ThemedView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: Spacing.six,
    left: 0,
    right: 0,
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  pill: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
    maxWidth: '90%',
  },
});
