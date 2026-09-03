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

export function useTheme() {
  // LIGHT ALWAYS, from 2026-09-03. The system setting is deliberately ignored.
  //
  // Part Fifteen specified a dark mode that inverts the palette's roles -
  // terracotta as the ground, cream as the text - and it was built and contrast-
  // verified. On a real phone in dark mode it reads as heavy and brown rather
  // than as Selodia, and brand consistency wins at this stage. Colors.dark is
  // left intact rather than deleted: the work was correct, it is only unused,
  // and reinstating it later should be a change to this function alone.
  return Colors.light;
}
