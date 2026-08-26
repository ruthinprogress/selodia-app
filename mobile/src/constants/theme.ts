/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// THE SINGLE SOURCE OF COLOUR. Every colour the app draws comes from here, and
// nothing outside this file may name one - see the tokens added 2026-08-26,
// which exist so that six literals scattered across components (three modal
// scrims, a link colour, and the Expo-template blue in the splash icon) had
// somewhere to live.
//
// That matters because the confirmed brand palette (cream, sand, terracotta,
// sage, forest, charcoal - Part Fifteen) has not been applied yet. When it is,
// it should be an edit to this object and nothing else. A literal anywhere else
// is a colour that would silently survive the swap and sit wrong beside it.
//
// `accent` and `accentDeep` are currently the Expo template's blue. They are
// the two values that become terracotta.
export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    danger: '#D14343',
    accent: '#208AEF',
    accentDeep: '#0274DF',
    link: '#3c87f7',
    // Modal backdrop. Dark in both themes on purpose: a scrim's job is to push
    // the page back behind the sheet, which a light one cannot do on a light
    // ground. Only the depth changes.
    scrim: 'rgba(0,0,0,0.45)',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    danger: '#FF6B6B',
    accent: '#3C9FFE',
    accentDeep: '#0274DF',
    link: '#5FA3FF',
    scrim: 'rgba(0,0,0,0.6)',
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
