import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// The shared Tag component (UNFLUMP_SPEC.md, Established Design-System
// Elements): ONE component, two contexts — food *confidence* and activity
// *intensity*. Deliberately not two lookalike components, so a tag means the
// same thing wherever it appears.
//
// The two contexts read their own stored vocabulary directly:
//   confidence — food_logs.confidence: 'clear' | 'uncertain'
//   intensity  — activity_logs.intensity: 'light' | 'moderate' | 'intense'
//                (captured at log time by item 33; nothing consumes it yet, and
//                 the Activity segment can pass the raw string straight in)
//
// A null/unrecognised value renders NOTHING rather than a placeholder — older
// rows predate both classifications, and an "unknown" chip would be clutter
// against data that simply isn't there (Part Two, principle 8).

export type TagContext = 'confidence' | 'intensity';

const LABELS: Record<TagContext, Record<string, string>> = {
  // "Lower confidence" rather than "Low" — the spec's wording. It describes the
  // estimate, never the person's logging, and stays non-judgmental about a
  // restaurant meal that genuinely can't be read precisely.
  confidence: { clear: 'High', uncertain: 'Lower confidence' },
  intensity: { light: 'Light', moderate: 'Moderate', intense: 'Intense' },
};

// Exported for testing and for callers that want to know whether a value will
// render before laying out around it.
export function tagLabel(context: TagContext, value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  return LABELS[context][value.toLowerCase()] ?? null;
}

export function Tag({ context, value }: { context: TagContext; value: string | null | undefined }) {
  const label = tagLabel(context, value);
  if (label == null) return null;

  return (
    <ThemedView type="backgroundElement" style={styles.tag}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
        {label}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  tag: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.two,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    lineHeight: 15,
  },
});
