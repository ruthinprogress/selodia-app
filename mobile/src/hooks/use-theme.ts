/**
 * The ONE way to read a colour. Everything that draws goes through this hook,
 * so a palette change lands in constants/theme.ts and nowhere else.
 *
 * Deliberately NOT a context provider yet. A provider earns its place when the
 * theme can be overridden - a user preference of system/light/dark - and there
 * is nowhere to set that today: account settings are unbuilt (item 41). A
 * preference nothing can change would be unreachable code, which is the exact
 * defect Development Workflow Principle 4 calls out. The hook keeps every call
 * site identical, so introducing a provider later changes this file alone.
 *
 * Light and dark modes: https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();
  // 'unspecified' is a real value on Android when no system preference is set.
  const theme = scheme === 'unspecified' || scheme == null ? 'light' : scheme;
  return Colors[theme];
}
