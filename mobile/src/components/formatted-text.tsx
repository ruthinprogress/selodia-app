import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BodyFont, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { blocks, isPlain, type Run } from '@/lib/rich-text';

// TEXT THE APP OR A MODEL WROTE, DRAWN AS WHAT IT MEANS RATHER THAN AS ITS MARKS.
//
// Ruth, 12 October 2026, on a care record that showed "**Seen by**" on her
// phone: "the awful formatting instantly makes me feel like it's a junk app I
// can't trust." One component, used by the chat bubbles and the Me tab, so the
// same string reads the same way in both and there is one place to get it
// right. See lib/rich-text.ts for what counts as a mark.
//
// THE CHEAP PATH IS THE COMMON ONE. An ordinary sentence is one string in one
// Text, exactly as it was, so a reply with nothing to format costs nothing.

type Props = {
  text: string;
  /** The size of the running text. Headings, bullets and notes follow it. */
  type?: 'small' | 'detail';
  themeColor?: ThemeColor;
  selectable?: boolean;
};

export function FormattedText({ text, type = 'small', themeColor, selectable }: Props) {
  const theme = useTheme();
  const parsed = useMemo(() => (isPlain(text) ? null : blocks(text)), [text]);

  if (!parsed) {
    return (
      <ThemedText type={type} themeColor={themeColor} selectable={selectable}>
        {text.trim()}
      </ThemedText>
    );
  }

  const inline = (rs: Run[]) =>
    rs.map((r, i) => (
      <Text
        key={i}
        style={[
          r.bold && styles.bold,
          // QUIET RATHER THAN SLANTED. Manrope is loaded without an italic face,
          // so on Android fontStyle alone would draw nothing different. The
          // colour step is what makes an aside read as one on every phone.
          r.italic && [styles.italic, { color: theme.textSecondary }],
        ]}
      >
        {r.text}
      </Text>
    ));

  return (
    <View style={styles.wrap}>
      {parsed.map((b, i) => {
        if (b.kind === 'heading') {
          return (
            <ThemedText
              key={i}
              type="detail"
              themeColor="textSecondary"
              selectable={selectable}
              style={[styles.heading, i > 0 && styles.headingAfter]}
            >
              {b.text}
            </ThemedText>
          );
        }
        if (b.kind === 'note') {
          return (
            <ThemedText
              key={i}
              type="detail"
              themeColor="textSecondary"
              selectable={selectable}
              style={[styles.italic, i > 0 && styles.noteAfter]}
            >
              {b.text}
            </ThemedText>
          );
        }
        if (b.kind === 'bullet') {
          return (
            <View key={i} style={styles.bulletRow}>
              <ThemedText type={type} themeColor="textSecondary" style={styles.marker}>
                {b.marker}
              </ThemedText>
              <ThemedText type={type} themeColor={themeColor} selectable={selectable} style={styles.bulletText}>
                {inline(b.runs)}
              </ThemedText>
            </View>
          );
        }
        return (
          <ThemedText key={i} type={type} themeColor={themeColor} selectable={selectable}>
            {inline(b.runs)}
          </ThemedText>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one + Spacing.half },
  bold: { fontFamily: BodyFont.semibold },
  italic: { fontStyle: 'italic' },
  // A LABEL, NOT A TITLE. The same treatment as "Latest" on a Me card: small,
  // spaced capitals in the secondary colour. A record has up to ten of these,
  // and anything louder turns it into a page of headlines.
  heading: {
    fontFamily: BodyFont.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  headingAfter: { marginTop: Spacing.two },
  noteAfter: { marginTop: Spacing.one },
  bulletRow: { flexDirection: 'row', gap: Spacing.two, paddingLeft: Spacing.half },
  // Wide enough for "10." so a numbered list does not shift at the tenth step.
  marker: { minWidth: 16 },
  bulletText: { flex: 1, minWidth: 0 },
});
