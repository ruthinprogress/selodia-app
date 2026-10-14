import { openBrowserAsync } from 'expo-web-browser';
import { useMemo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

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

  // A LINK OPENS WHAT IT SAYS (Ruth, 14 October 2026: "also anything that can
  // be a live link to reduce friction, should be, eg, your doctor surgery to
  // message for referrals or apts at Klinik").
  //
  // A web address goes to the app's own browser, so one swipe comes back to
  // where she was. tel: and mailto: hand off to the phone, which the in-app
  // browser cannot do. A failure says nothing: the address is still on screen
  // and still readable, which is what it was before it was tappable.
  const open = async (url: string) => {
    try {
      if (url.startsWith('http')) await openBrowserAsync(url);
      else await Linking.openURL(url);
    } catch {
      // Nothing to say.
    }
  };

  const inline = (rs: Run[]) =>
    rs.map((r, i) => (
      <Text
        key={i}
        onPress={r.link ? () => void open(r.link as string) : undefined}
        // UNDERLINED AS WELL AS COLOURED, because the accent alone is not
        // enough on its own for anybody who cannot separate the two colours,
        // and this is a phone number somebody may need to ring.
        style={[
          r.bold && styles.bold,
          // QUIET RATHER THAN SLANTED. Manrope is loaded without an italic face,
          // so on Android fontStyle alone would draw nothing different. The
          // colour step is what makes an aside read as one on every phone.
          r.italic && [styles.italic, { color: theme.textSecondary }],
          r.link && [styles.link, { color: theme.accentDeep }],
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
              type={type}
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
  // A HEADING, NOT A CAPTION (Ruth, 14 October 2026: "there aren't proper bold
  // headers"). It was small spaced capitals in the secondary colour, borrowed
  // from the "Latest" label on a Me card, and at 12px in grey it read as a
  // footnote above the thing it was meant to head. A heading is the body size,
  // the body colour, and bold - the way it looks in the chat she compares this
  // with.
  heading: {
    fontFamily: BodyFont.semibold,
  },
  headingAfter: { marginTop: Spacing.three },
  noteAfter: { marginTop: Spacing.one },
  bulletRow: { flexDirection: 'row', gap: Spacing.two, paddingLeft: Spacing.half },
  // Wide enough for "10." so a numbered list does not shift at the tenth step.
  marker: { minWidth: 16 },
  bulletText: { flex: 1, minWidth: 0 },
  link: { textDecorationLine: 'underline' },
});
