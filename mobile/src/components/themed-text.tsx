import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { BodyFont, DisplayFont, Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'display'
    | 'title'
    | 'small'
    | 'smallBold'
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
    lineHeight: 20,
    fontFamily: BodyFont.regular,
  },
  // Section headers land here, so this one takes Comfortaa despite its size.
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: BodyFont.semibold,
  },
  // MANROPE CARRIES THE TEXT, THE SERIF CARRIES THE HEADINGS (2026-09-18).
  // Comfortaa used to carry both. `small` sat on the system face for exactly
  // the reason Manrope now replaces it: a rounded display face is the wrong
  // tool for dense utility text. The difference is that the system face varies
  // by phone, and this does not.
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: BodyFont.regular,
  },
  // THE SERIF PAIR (2026-09-17). display is a screen's own name, sectionTitle is
  // a section within it. Both run larger than their Comfortaa equivalents
  // because Cormorant's x-height is smaller: 36px of garamond sits at about the
  // optical size of 30px of Comfortaa, so matching the numbers would quietly
  // demote every heading in the app.
  display: {
    fontSize: 38,
    lineHeight: 46,
    fontFamily: DisplayFont.medium,
  },
  sectionTitle: {
    fontSize: 26,
    lineHeight: 34,
    fontFamily: DisplayFont.medium,
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
