import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { BodyFont, DisplayFont, DisplayType, Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'display'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'detail'
    | 'subtitle'
    | 'sectionTitle'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'display' && styles.display,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'detail' && styles.detail,
        type === 'subtitle' && styles.subtitle,
        type === 'sectionTitle' && styles.sectionTitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && [styles.linkPrimary, { color: theme.link }],
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    // Generous rather than tight: the brief asks for body copy that is never
    // heavy and always secondary to the display type, and leading is most of
    // what does that.
    lineHeight: 22,
    fontFamily: BodyFont.regular,
  },
  // Section headers land here, so this one takes Comfortaa despite its size.
  smallBold: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: BodyFont.semibold,
  },
  // MANROPE CARRIES THE TEXT, THE SERIF CARRIES THE HEADINGS (2026-09-18).
  // Comfortaa used to carry both. `small` sat on the system face for exactly
  // the reason Manrope now replaces it: a rounded display face is the wrong
  // tool for dense utility text. The difference is that the system face varies
  // by phone, and this does not.
  default: {
    fontSize: 16,
    lineHeight: 26,
    fontFamily: BodyFont.regular,
  },
  // THE SERIF PAIR. display is a screen's own name, sectionTitle is a section
  // within it. Both run far larger than the sans they replaced: a display face
  // at 38 is a label, and at 50 it is a page. See DisplayFont in theme.ts for
  // why the weight is regular and the tracking is zero.
  display: {
    fontSize: DisplayType.size,
    lineHeight: DisplayType.leading,
    letterSpacing: DisplayType.tracking,
    fontFamily: DisplayFont.regular,
  },
  sectionTitle: {
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: DisplayType.tracking,
    fontFamily: DisplayFont.regular,
  },
  // 48px until 2026-09-03, where it dominated every screen it opened. 32 is
  // still unmistakably the page's heading without being the whole page.
  title: {
    fontSize: 32,
    lineHeight: 40,
    fontFamily: BodyFont.semibold,
  },
  subtitle: {
    fontSize: 24,
    lineHeight: 32,
    fontFamily: BodyFont.semibold,
  },
  // SECONDARY DATA, a step quieter than body text (Ruth, 2026-09-18: the
  // Movement flow "almost feels like an accessibility mode designed for users
  // with significant visual impairment"). Sets, reps, a last weight, a state:
  // facts you read after the name, not with it. 12/17 rather than 14/22, which
  // is the difference between a caption and a second sentence.
  detail: {
    fontFamily: BodyFont.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    // Colour comes from theme.link at render (see the linkPrimary branch).
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
