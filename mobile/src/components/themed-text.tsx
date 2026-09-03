import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { BrandFont, Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
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
    fontWeight: 500,
  },
  // Section headers land here, so this one takes Comfortaa despite its size.
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: BrandFont.semibold,
  },
  // Comfortaa carries display, headings and section headers. `small`, `link`
  // and `code` stay on the system face: a rounded display type is the wrong
  // tool for dense utility text, and the system font is what a phone reads
  // most comfortably at 14px.
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: BrandFont.regular,
  },
  // 48px until 2026-09-03, where it dominated every screen it opened. 32 is
  // still unmistakably the page's heading without being the whole page.
  title: {
    fontSize: 32,
    lineHeight: 40,
    fontFamily: BrandFont.semibold,
  },
  subtitle: {
    fontSize: 24,
    lineHeight: 32,
    fontFamily: BrandFont.semibold,
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
