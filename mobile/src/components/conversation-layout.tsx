import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';

// The shell every conversation screen shares: Chat and the seven onboarding
// steps, which are all ScrollView-of-bubbles plus a fixed input row.
//
// WHY IT EXISTS. Found live 2026-08-27: the phone's keyboard covered the text
// input, so you could not see what you were typing - which breaks the core loop
// of an app whose whole premise is conversation. Nothing anywhere in src/
// listened for the keyboard at all.
//
// WHY behavior="padding" ON BOTH PLATFORMS. `softwareKeyboardLayoutMode`
// defaults to `resize`, and historically that meant Android needed no behavior
// at all. Expo's own config types warn that once the status bar floats above
// content, `resize` stops being reliable and "you will have to use
// KeyboardAvoidingView to manage the keyboard layout" - which is our situation.
// With the window not resizing, padding is additive and correct on both.
//
// The failure modes are deliberately asymmetric. If Android turns out to resize
// after all, padding double-counts and the input sits too HIGH - visible and
// annoying. Passing no behavior instead would leave the input covered if the
// window does not resize, which is the bug unfixed. Too high beats invisible.
//
// NOT react-native-keyboard-controller, though reanimated's useAnimatedKeyboard
// now deprecates in its favour: it is a new native module, so it could not reach
// a phone without a fresh EAS build, while this ships over EAS Update today. It
// is the right upgrade if this proves insufficient on device.
export function ConversationLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'web' ? undefined : 'padding'}
      >
        {children}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
