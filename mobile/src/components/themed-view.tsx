import { View, type ViewProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// lightColor/darkColor are deliberately absent. They came from the Expo
// template, which themed each component by handing it a colour per scheme; this
// project replaced that with the `type` token system, where a component names a
// ROLE and the theme decides the colour. The two props survived the switch as
// dead weight - declared, destructured, never read, and never passed by a single
// caller. Removing the type and the destructure together matters: dropping only
// the destructure would let them fall through `otherProps` onto the native View.
export type ThemedViewProps = ViewProps & {
  type?: ThemeColor;
};

export function ThemedView({ style, type, ...otherProps }: ThemedViewProps) {
  const theme = useTheme();

  return <View style={[{ backgroundColor: theme[type ?? 'background'] }, style]} {...otherProps} />;
}
