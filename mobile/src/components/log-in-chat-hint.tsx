import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hasSeenTabTooltip, markTabTooltipSeen, type TooltipTab } from '@/lib/tab-tooltips';

// A one-time line telling somebody the thing they are doing here can also be
// said in Chat.
//
// ONCE PER SCREEN, AND ONLY ONCE. The seen-flag lives on the account, not the
// device (see tab-tooltips.ts), so it does not come back after a reinstall or
// on a second phone.
//
// IT IS AN ASIDE, NOT AN ANNOUNCEMENT. No card, no icon shouting for
// attention, no overlay that has to be dealt with before the screen can be
// used: a quiet line at the top with a close control, and it never returns.
// Anything more insistent would be teaching by interruption, on a screen the
// person opened to do something else.
//
// IT FAILS CLOSED. Until the check returns it renders nothing, so it can never
// flash on and off, and any error is treated as already-seen.
export function LogInChatHint({ tab }: { tab: TooltipTab }) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    hasSeenTabTooltip(tab)
      .then((seen) => {
        if (alive && !seen) setVisible(true);
      })
      .catch(() => {
        // Already handled inside the helper; nothing to add here.
      });
    return () => {
      alive = false;
    };
  }, [tab]);

  if (!visible) return null;

  return (
    <ThemedView type="backgroundElement" style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
        You can also log this in Chat
      </ThemedText>
      <Pressable
        onPress={() => {
          // Hidden immediately, stamped in the background. A dismiss that waits
          // on a round trip feels broken, and the worst case if the write fails
          // is that the line appears once more.
          setVisible(false);
          void markTabTooltipSeen(tab);
        }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        hitSlop={Spacing.three}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Ionicons name="close" size={16} color={theme.textSecondary} />
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  text: { flexShrink: 1 },
  pressed: { opacity: 0.6 },
});
