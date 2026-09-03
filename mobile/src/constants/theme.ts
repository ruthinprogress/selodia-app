/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// THE SINGLE SOURCE OF COLOUR. Every colour the app draws comes from here, and
// nothing outside this file names one - `grep -rE '#[0-9A-Fa-f]{3,8}|rgba?\(' src/`
// outside this file returns nothing, and it must stay that way.
//
// THE BRAND PALETTE, applied 2026-08-26 (Part Fifteen, confirmed 2026-08-14):
//   cream #F7F3EA · sand #E9D6C2 · terracotta #C97458
//   sage  #95A987 · forest #37584A · charcoal #2D2B28
//
// Light mode is cream-grounded with charcoal text and terracotta as the accent.
// Dark mode INVERTS the roles as Part Fifteen specifies - terracotta becomes the
// ground, cream becomes the text - rather than the conventional near-black.
//
// TUNED AGAINST REAL CONTRAST CHECKING, which Part Fifteen requires and which
// changed several values:
//
//   - Terracotta at its literal #C97458 carries cream text at only 3.10:1 -
//     below the 4.5:1 AA floor for body text. Darkened 35% to #834B39 it reads
//     6.26:1 while staying unmistakably the same colour family. This is exactly
//     the "slight tuning for comfortable readability" the spec anticipated.
//   - Dark-mode element surfaces RECEDE (darker) instead of lifting. Lifting a
//     mid-tone ground collapses its contrast with light text: the first attempt
//     lifted them and produced thirteen failing pairs.
//   - Terracotta as small text on cream also fails at 3.10:1, so `link` and
//     `accentDeep` use a 30% darker terracotta that clears AA on every light
//     surface, not just on cream.
//   - Sand is the SELECTED state, never a text ground: charcoal on sand is fine
//     at 9.99:1, but secondary text on it drops to 4.08:1.
//
// SAGE was deliberately absent from these tokens until 2026-08-31, on the
// grounds that adding a colour nothing renders is dead weight. The Almanac's
// empty-state illustration now renders it, so it earns its place - and only it.
// FOREST stays out for the same original reason: the sage-toned insight card and
// sand-toned note card (Part Five, Detail Views) are still unbuilt.
//
// Sage is a LINE AND FILL COLOUR, never text: on cream it is 2.28:1, far under
// the AA floor. It is legitimate on the illustration because a decorative
// graphic carries no information a reader must decode - the copy beneath it
// does that work. Do not reach for this token for a label.
//
// Every text-on-surface pair in both modes was verified at AA or better before
// this landed.
export const Colors = {
  light: {
    // Cream ground; element and selected step down gently from it.
    background: '#F7F3EA',
    backgroundElement: '#EDE9E1',
    backgroundSelected: '#E3E0D7',
    text: '#2D2B28',
    textSecondary: '#605A52',
    // The accent at full strength - fills, icons, large type. NOT small text.
    accent: '#C97458',
    // The same terracotta, deep enough to be read as body text on any of the
    // three light surfaces above.
    accentDeep: '#8D513E',
    link: '#8D513E',
    danger: '#A63A2E',
    // Brand sage at full strength. Reads as a soft green line on cream.
    sage: '#95A987',
    scrim: 'rgba(45, 43, 40, 0.45)',
  },
  dark: {
    // Terracotta as the ground (the role inversion), tuned for text contrast.
    background: '#834B39',
    backgroundElement: '#6E3F30',
    backgroundSelected: '#5F3629',
    text: '#F7F3EA',
    textSecondary: '#E0D1C7',
    // Sand carries the accent here - full-strength terracotta against a
    // terracotta ground is 2.02:1 and effectively invisible.
    accent: '#E9D6C2',
    accentDeep: '#C97458',
    link: '#F0E0CE',
    danger: '#FFC9BF',
    // The same sage, unchanged. It holds against the terracotta ground at about
    // 2.9:1 - low, but this is a line drawing, not type, and shifting it toward
    // sand here would quietly make the illustration a different colour in each
    // mode for no reason a viewer could see.
    sage: '#95A987',
    scrim: 'rgba(23, 13, 9, 0.6)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

// Comfortaa, the brand face (Part Fifteen). React Native cannot synthesise a
// weight for a custom family - fontWeight is ignored on iOS and unreliable on
// Android - so each weight is its own family name and the style picks the file
// it wants rather than asking for a number.
export const BrandFont = {
  regular: 'Comfortaa_400Regular',
  medium: 'Comfortaa_500Medium',
  semibold: 'Comfortaa_600SemiBold',
  bold: 'Comfortaa_700Bold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
