import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

// The second export entry point (build item 41 — Part Five).
//
// Part Five asks for "two discoverable entry points to the same one export
// function", and names this one exactly: "a quiet link from the history/week
// view itself, since that is where someone browsing old data would naturally
// think to look."
//
// TWO ENTRY POINTS, ONE FUNCTION. This deliberately does NOT render its own copy
// of the export UI — it routes to Settings, where the single DataExport lives.
// Two surfaces that both gather data would be two things to keep in step, and
// the spec's own wording ("the same one export function") rules that out.
//
// QUIET is the requirement, so this is a text link under the history rather than
// a button beside it. Someone reviewing their week is not looking for this; it
// only has to be there when they think to look.

export function ExportLink() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push('/settings')}
      accessibilityRole="button"
      accessibilityLabel="Get a copy of your data"
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <ThemedText type="small" themeColor="link">
        Get a copy of your data
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: Spacing.four,
    paddingVertical: Spacing.one,
    alignSelf: 'flex-start',
  },
  pressed: { opacity: 0.6 },
});
