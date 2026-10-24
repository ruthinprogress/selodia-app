import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { BodyFont, DisplayFont, DisplayType, Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'display'
    | 'pageTitle'
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
        type === 'pageTitle' && styles.pageTitle,
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
    // what does that. Brought in from 22 on 2026-09-18 - 1.5 rather than 1.57 -
    // because at chat length that leading was spending a line of screen every
    // four lines of reading, and the page read as enlarged rather than airy.
    lineHeight: 21,
    fontFamily: BodyFont.regular,
  },
  // A HEADING IS A HEADING AT ANY SIZE (Ruth, 24 October 2026):
  //
  //   "Any title in the app that's in bold should be in the header font, it
  //    looks like coding text in the current font, not editorial at all."
  //
  // She is describing something real. Manrope SemiBold is a grotesque drawn for
  // interfaces - it is what the figures and the labels are set in, and it is
  // excellent at that. Used for a HEADING it reads as a stronger label rather
  // than as a different kind of thing, so every section on every screen was
  // announced in the same voice as the data beneath it.
  //
  // The serif is the app's heading voice, and it was being used only for a
  // screen's own name. This puts it on the three bold types - smallBold,
  // subtitle, title - so a section heading anywhere in the app is editorial.
  //
  // THE SIZES GO UP SLIGHTLY WITH THE FACE. Cormorant Infant has a small
  // x-height, so it reads about a point smaller than a sans at the same size;
  // 15 here holds the same presence 14 did.
  // SIZED UP AGAIN, 24 October 2026, after she saw it on the phone: "Everywhere
  // where you changed the header font, it's too small, could be almost twice as
  // big."
  //
  // She is right and the reason is the face. Cormorant Infant has a notably
  // small x-height, so at a given point size it reads a good deal smaller than
  // the sans it replaced - setting it at 15 where Manrope had been at 14 kept
  // the number almost the same and lost presence. A serif heading has to be set
  // LARGER than the sans it replaces to carry the same weight on the page.
  smallBold: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: DisplayType.tracking,
    fontFamily: DisplayFont.regular,
    paddingBottom: 2,
  },
  // MANROPE CARRIES THE TEXT, THE SERIF CARRIES THE HEADINGS (2026-09-18).
  // Comfortaa used to carry both. `small` sat on the system face for exactly
  // the reason Manrope now replaces it: a rounded display face is the wrong
  // tool for dense utility text. The difference is that the system face varies
  // by phone, and this does not.
  default: {
    // 16/26 until 2026-09-18 (Ruth: "slightly reduce the default body text size,
    // around 1-2pt if appropriate"). 15/23 keeps the same colour on the page and
    // gives back roughly a line in eight.
    fontSize: 15,
    lineHeight: 23,
    fontFamily: BodyFont.regular,
  },
  // THE SERIF PAIR. display is a screen's own name, sectionTitle is a section
  // within it. Both run far larger than the sans they replaced: a display face
  // at 38 is a label, and at 50 it is a page. See DisplayFont in theme.ts for
  // why the weight is regular and the tracking is zero.
  display: {
    fontSize: DisplayType.size,
    // LEADING LOOSE ENOUGH FOR A DESCENDER (Ruth, 25 September 2026: the Log
    // screen was STILL drawing its own name as "Loq", a week after a fix for
    // exactly that).
    //
    // The old fix added paddingBottom, which cannot work. Android clips the
    // glyph inside the LINE BOX and padding sits outside it, so with leading of
    // 47 on a size of 50 the box is shorter than the letter and the tail of a g
    // is cut before any padding is reached. It only ever showed on the LAST
    // line, which is why the two-line greeting looked fine and every
    // single-line title with a descender did not.
    //
    // DisplayType.leading is still what the greeting uses - overview-panel asks
    // for it explicitly - because tight leading is what makes two lines read as
    // one block, and that was chosen on a real screen. Everything else using
    // this style is a single-line title, which has no block to keep tight.
    lineHeight: 64,
    letterSpacing: DisplayType.tracking,
    fontFamily: DisplayFont.regular,
    // ROOM FOR THE DESCENDER (Ruth, 2026-09-18: the Log screen drew its own name
    // as "Loq"). The leading is deliberately tighter than the size - 47 on 50,
    // which is what makes the two-line greeting read as one block - and Android
    // clips a glyph at the bottom of the text view rather than letting it hang.
    // The tail of a g needs about eight points below the last baseline box, so
    // it is given ten here. This does NOT loosen the leading: the lines stay
    // exactly as close as she chose, and only the space beneath the last one
    // changes.
    paddingBottom: 10,
  },
  // A SCREEN ONE LEVEL IN (Ruth, 25 September 2026). The Log's Food, Activity,
  // Hydration and the rest had no name of their own at all: the stack header
  // carried a small sans "Food" and that was it, so they were the only screens
  // in the app that did not introduce themselves the way the tabs do.
  //
  // Smaller than a tab's own name, which is hers: "perhaps slightly smaller
  // than the main pages". 50 is a page you arrived at, 40 is a page you opened
  // from one. It keeps display's descender padding for the same reason - the
  // Log screen once drew its own name as "Loq".
  pageTitle: {
    fontSize: 40,
    // Room for the descender, for the reason spelled out on display above.
    // These are always one line, so there is no block to keep tight.
    lineHeight: 52,
    letterSpacing: DisplayType.tracking,
    fontFamily: DisplayFont.regular,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: DisplayType.tracking,
    fontFamily: DisplayFont.regular,
  },
  // 48px until 2026-09-03, where it dominated every screen it opened. 32 is
  // still unmistakably the page's heading without being the whole page.
  // Both carry the serif now - see smallBold above for her rule. They keep
  // the descender room the other display types have, because a heading ending
  // in a g is clipped by Android inside its line box, not outside it.
  title: {
    fontSize: 44,
    lineHeight: 56,
    letterSpacing: DisplayType.tracking,
    fontFamily: DisplayFont.regular,
    paddingBottom: 4,
  },
  subtitle: {
    fontSize: 34,
    lineHeight: 44,
    letterSpacing: DisplayType.tracking,
    fontFamily: DisplayFont.regular,
    paddingBottom: 3,
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
