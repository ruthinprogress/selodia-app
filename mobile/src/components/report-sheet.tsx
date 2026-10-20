import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { reportBug, reportContext } from '@/lib/report-bug';

// SOMETHING IS WRONG, FROM THE SCREEN IT IS WRONG ON.
//
// Ruth, 18 October 2026: "while its in Beta there should be a quick tap way for
// users to report."
//
// IT OPENS WHERE SHE IS, which is the whole gain. The form in Settings is three
// taps away and by the time anybody reaches it they have navigated off the
// thing that went wrong - so the screen name, which is often the only usable
// clue in a stranger's report, was already stale when it was collected. From
// here it is the screen under the sheet.
//
// THE PICTURE IS OFFERED, NOT TAKEN, and that is a deliberate cut rather than a
// shortfall. Capturing the screen needs react-native-view-shot, a native module
// that cannot ship over the air - it would hold this behind a whole store
// build. Android's own screenshot is one button press and already in the
// library, which is the same reasoning the beta feedback flow reached.
//
// AND SHE IS SHOWN WHAT IS ATTACHED. settings/feedback.tsx settled this: "An
// app that quietly collects things in the background while asking for help is
// the opposite of what this product is for, and the list is short enough to
// print." It is shorter still here, so it is printed.

export function ReportSheet({
  onClose,
  from,
}: {
  onClose: () => void;
  /**
   * THE SCREEN SHE WAS ON, PASSED IN RATHER THAN LOOKED UP.
   *
   * Ruth's first two reports through this button both arrived with no screen
   * on them, which is the one field the button was put on every screen to
   * capture. reportBug falls back to lastScreen(), and lastScreen() is only
   * ever written by the More mark - so the beetle, which does not go through
   * More, recorded nothing.
   *
   * It does not need the fallback anyway. The Settings form has to remember
   * where somebody CAME FROM, because by the time it is open they have
   * navigated away. This sheet opens on top of the screen in question, so the
   * current route is the right answer and the simplest one.
   */
  from?: string | null;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const clearance = BottomTabInset || 80;

  const [text, setText] = useState('');
  const [shot, setShot] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sent, setSent] = useState<{ screenshotLost: boolean } | null>(null);

  const ctx = reportContext();

  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });
    if (!res.canceled && res.assets[0]) setShot(res.assets[0].uri);
  }

  async function send() {
    if (sending || !text.trim()) return;
    setSending(true);
    setFailed(false);
    const result = await reportBug({ message: text, screenshotUri: shot, screen: from });
    setSending(false);
    if (result.ok) setSent({ screenshotLost: result.screenshotLost });
    else setFailed(true);
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ThemedView style={[styles.sheet, { paddingBottom: insets.bottom + clearance }]}>
          <View style={[styles.grabber, { backgroundColor: theme.backgroundSelected }]} />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {sent ? (
              <>
                <ThemedText type="sectionTitle">Thank you</ThemedText>
                <ThemedText type="small">
                  That has gone to the list we go through every day.
                </ThemedText>
                {/* SAID, NOT SWALLOWED. The report landed and the picture did
                    not, and she is the only person who can send it again. */}
                {sent.screenshotLost ? (
                  <ThemedText type="small" themeColor="accentDeep">
                    The picture did not upload, though everything else did.
                  </ThemedText>
                ) : null}
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  style={({ pressed }) => pressed && styles.pressed}>
                  <View style={[styles.cta, { backgroundColor: theme.accentDeep }]}>
                    <ThemedText type="smallBold" themeColor="background">
                      Done
                    </ThemedText>
                  </View>
                </Pressable>
              </>
            ) : (
              <>
                <ThemedText type="sectionTitle">Something not right?</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Say what happened and what you expected. Anything at all is useful.
                </ThemedText>

                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="What went wrong?"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  accessibilityLabel="What went wrong"
                  style={[
                    styles.input,
                    { borderColor: theme.backgroundSelected, color: theme.text },
                  ]}
                />

                {shot ? (
                  <View style={styles.shotRow}>
                    <Image
                      source={{ uri: shot }}
                      style={styles.shot}
                      alt="The picture you attached"
                      accessibilityLabel="The picture you attached"
                    />
                    <Pressable
                      onPress={() => setShot(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Take the picture off"
                      hitSlop={Spacing.two}
                      style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
                      <ThemedText type="small" themeColor="accentDeep">
                        Take it off
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => void pick()}
                    accessibilityRole="button"
                    accessibilityLabel="Add a picture"
                    accessibilityHint="Opens your photos, where your own screenshot already is"
                    hitSlop={Spacing.two}
                    style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
                    <ThemedText type="small" themeColor="accentDeep">
                      Add a picture
                    </ThemedText>
                  </Pressable>
                )}

                {/* PRINTED, NOT SUMMARISED. Four short facts, so nobody has to
                    take our word for what "some technical details" means. */}
                <ThemedText type="small" themeColor="textSecondary">
                  Sent with this: the screen you were on
                  {ctx.screen ? ` (${ctx.screen})` : ''}, your app version
                  {ctx.runtimeVersion ? ` (${ctx.runtimeVersion})` : ''}, and your phone
                  {` (${ctx.platform} ${ctx.osVersion})`}. Nothing else.
                </ThemedText>

                {failed ? (
                  <ThemedText type="small" themeColor="accentDeep">
                    That did not send. Check your connection and try again.
                  </ThemedText>
                ) : null}

                <Pressable
                  onPress={() => void send()}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: sending || !text.trim() }}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <View
                    style={[
                      styles.cta,
                      {
                        backgroundColor: text.trim()
                          ? theme.accentDeep
                          : theme.backgroundSelected,
                      },
                    ]}>
                    <ThemedText
                      type="smallBold"
                      themeColor={text.trim() ? 'background' : 'textSecondary'}>
                      {sending ? 'Sending…' : 'Send'}
                    </ThemedText>
                  </View>
                </Pressable>
              </>
            )}
          </ScrollView>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create<{
  scrim: ViewStyle;
  sheet: ViewStyle;
  grabber: ViewStyle;
  body: ViewStyle;
  input: TextStyle;
  shotRow: ViewStyle;
  shot: ImageStyle;
  action: ViewStyle;
  cta: ViewStyle;
  pressed: ViewStyle;
}>({
  scrim: { flex: 1, backgroundColor: 'rgba(23, 13, 9, 0.35)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' },
  grabber: { width: 44, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.three },
  body: { padding: Spacing.four, gap: Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: CardRadius,
    padding: Spacing.three,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  shotRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  shot: { width: 56, height: 96, borderRadius: 8 },
  action: { minHeight: 44, justifyContent: 'center' },
  cta: {
    borderRadius: CardRadius,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  pressed: { opacity: 0.7 },
});
